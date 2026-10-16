"""Fit, calibrate and evaluate the tile anomaly model on MVTec AD (category: tile).

Usage (from the repository root):
    python -m ml.train --data /path/to/mvtec_anomaly_detection --category tile

Data discipline (this is what the evaluation report is built on):
  * train/good  -> split into FIT (memory bank) and VAL-NORMAL (threshold calibration only)
  * test/*      -> never used for fitting or threshold choice; scored once for the final report
  * No defective image is ever used for training.
"""
import argparse
import json
import random
import time
from collections import Counter
from pathlib import Path

import numpy as np
from sklearn.metrics import confusion_matrix, precision_recall_fscore_support, roc_auc_score

from .quality import blur_score
from .tileml import FeatureExtractor, TileAnomalyModel, build_memory_bank, load_rgb

EXTS = {".png", ".jpg", ".jpeg", ".bmp"}


def list_images(folder: Path):
    return sorted(p for p in folder.iterdir() if p.suffix.lower() in EXTS)


def metrics_at(scores, labels, thr):
    pred = (scores > thr).astype(int)
    tn, fp, fn, tp = confusion_matrix(labels, pred, labels=[0, 1]).ravel()
    p, r, f, _ = precision_recall_fscore_support(labels, pred, average="binary", zero_division=0)
    return {"threshold": float(thr), "tn": int(tn), "fp": int(fp), "fn": int(fn), "tp": int(tp),
            "precision": float(p), "recall": float(r), "f1": float(f)}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--data", required=True, help="MVTec AD root (contains the category folder)")
    ap.add_argument("--category", default="tile")
    ap.add_argument("--backbone", default="resnet18")
    ap.add_argument("--max-patches", type=int, default=60000)
    ap.add_argument("--val-frac", type=float, default=0.2)
    ap.add_argument("--band", type=float, default=0.10, help="+/- fraction around threshold treated as 'uncertain'")
    ap.add_argument("--seed", type=int, default=0)
    ap.add_argument("--out", default="ml/artifacts/tile_patchcore.pt")
    ap.add_argument("--report-dir", default="ml/reports")
    a = ap.parse_args()

    root = Path(a.data) / a.category
    train_files = list_images(root / "train" / "good")
    random.Random(a.seed).shuffle(train_files)
    n_val = max(1, int(len(train_files) * a.val_frac))
    val_files, fit_files = train_files[:n_val], train_files[n_val:]
    print(f"train/good: {len(train_files)} -> fit {len(fit_files)}, val-normal {len(val_files)}")

    extractor = FeatureExtractor(a.backbone, pretrained=True)
    t0 = time.time()
    bank = build_memory_bank(extractor, fit_files, a.max_patches, seed=a.seed)
    print(f"memory bank: {tuple(bank.shape)} in {time.time() - t0:.0f}s")
    version = f"{a.category}-{a.backbone}-{time.strftime('%Y%m%d')}"
    model = TileAnomalyModel(extractor, bank, None, a.band, {"name": "tile-patchcore-lite", "version": version})

    # Threshold = highest score among held-out NORMAL images (no false alarms on them by construction).
    val_scores = np.array([model.score_file(f) for f in val_files])
    model.threshold = float(val_scores.max())
    print(f"threshold (max val-normal score): {model.threshold:.4f}")

    # Final held-out evaluation.
    rows = []
    for sub in sorted(p for p in (root / "test").iterdir() if p.is_dir()):
        for f in list_images(sub):
            img = load_rgb(f)
            rows.append({"path": str(f.relative_to(Path(a.data))), "defect_type": sub.name,
                         "label": 0 if sub.name == "good" else 1,
                         "score": model.score_image(img), "blur": blur_score(img)})
    scores = np.array([r["score"] for r in rows])
    labels = np.array([r["label"] for r in rows])
    thr = model.threshold
    main_metrics = metrics_at(scores, labels, thr)
    auroc = float(roc_auc_score(labels, scores))
    sweep = [metrics_at(scores, labels, thr * k) for k in (0.7, 0.8, 0.9, 1.0, 1.1, 1.2, 1.3, 1.5)]
    per_type = {}
    for t in sorted({r["defect_type"] for r in rows if r["label"] == 1}):
        s = np.array([r["score"] for r in rows if r["defect_type"] == t])
        per_type[t] = {"n": int(len(s)), "detected": int((s > thr).sum()), "recall": float((s > thr).mean())}
    for r in rows:
        r["label_at_threshold"] = "defective" if r["score"] > thr else "good"
        r["uncertain"] = abs(r["score"] / thr - 1) <= a.band
    unc = [r for r in rows if r["uncertain"]]
    errors = [r for r in rows if (r["score"] > thr) != bool(r["label"])]
    report = {
        "model_version": version, "backbone": a.backbone, "category": a.category, "seed": a.seed,
        "counts": {"train_good_total": len(train_files), "fit": len(fit_files), "val_normal": len(val_files),
                   "test_total": len(rows), "test_by_type": dict(Counter(r["defect_type"] for r in rows))},
        "threshold": thr, "uncertain_band": a.band, "auroc": auroc, "at_threshold": main_metrics,
        "threshold_sweep": sweep, "per_defect_type_recall": per_type,
        "uncertain_zone": {"n": len(unc), "errors_inside": sum(1 for r in unc if r in errors),
                           "errors_outside": sum(1 for r in errors if r not in unc)},
        "errors": [{k: r[k] for k in ("path", "defect_type", "score")} for r in errors],
    }
    out_dir = Path(a.report_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    (out_dir / "test_manifest.json").write_text(json.dumps(
        {"model_version": version, "threshold": thr, "band": a.band, "files": rows}, indent=1))
    (out_dir / "eval_report.json").write_text(json.dumps(report, indent=1))
    (out_dir / "eval_report.md").write_text(render_md(report))
    model.save(a.out)

    fit_blur = [blur_score(load_rgb(f)) for f in fit_files]
    Path(a.out).with_name("quality.json").write_text(json.dumps(
        {"blur_threshold": float(min(fit_blur) * 0.5), "rule": "0.5 x lowest blur score among normal fit images"}))
    print(render_md(report))
    print(f"saved model -> {a.out}; reports -> {out_dir}")


def render_md(r):
    m = r["at_threshold"]
    L = ["# Tile anomaly detection - held-out evaluation", "",
         f"Model: `{r['model_version']}` (backbone {r['backbone']}, MVTec AD category `{r['category']}`)", "",
         "## Split", f"- Normal train images: {r['counts']['train_good_total']} "
         f"(fit {r['counts']['fit']}, threshold calibration {r['counts']['val_normal']})",
         f"- Held-out test images: {r['counts']['test_total']} - {r['counts']['test_by_type']}", "",
         f"## Result at the calibrated threshold ({r['threshold']:.4f})",
         "| | predicted good | predicted defective |", "|---|---|---|",
         f"| actually good | {m['tn']} | {m['fp']} |", f"| actually defective | {m['fn']} | {m['tp']} |", "",
         f"Precision {m['precision']:.3f}, recall {m['recall']:.3f}, F1 {m['f1']:.3f}, image AUROC {r['auroc']:.3f}", "",
         "## Recall by defect type", "| type | n | detected | recall |", "|---|---|---|---|"]
    L += [f"| {t} | {v['n']} | {v['detected']} | {v['recall']:.2f} |" for t, v in r["per_defect_type_recall"].items()]
    L += ["", "## Threshold sweep", "| threshold | TN | FP | FN | TP | precision | recall |", "|---|---|---|---|---|---|---|"]
    L += [f"| {s['threshold']:.3f} | {s['tn']} | {s['fp']} | {s['fn']} | {s['tp']} | {s['precision']:.2f} | {s['recall']:.2f} |"
          for s in r["threshold_sweep"]]
    u = r["uncertain_zone"]
    L += ["", f"## Uncertain band (+/-{r['uncertain_band']:.0%} of threshold)",
          f"{u['n']} test images fall inside; {u['errors_inside']} of the {u['errors_inside'] + u['errors_outside']} "
          "errors are inside it (these are routed to human review).", "", "## Misclassified test images"]
    L += [f"- `{e['path']}` ({e['defect_type']}), score {e['score']:.3f}" for e in r["errors"]] or ["- none"]
    L += ["", "Scores are distances, not probabilities. MVTec AD is licensed CC BY-NC-SA 4.0 (non-commercial)."]
    return "\n".join(L)


if __name__ == "__main__":
    main()
