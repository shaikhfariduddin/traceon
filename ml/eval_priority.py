"""Measure the innovation: does the review-priority order surface the model's mistakes sooner?

Reads ml/reports/test_manifest.json (written by train.py). For each held-out image the 'error' is whether the
model's decision at the threshold is wrong. We compare how many errors a reviewer has found after checking the
first k% of images when the queue is ordered by:
  (a) review priority (this project's innovation),
  (b) 'AI-flagged first' - highest anomaly score first, i.e. the obvious way to order a queue,
  (c) random order (mean of many shuffles).

    python -m ml.eval_priority [--manifest ml/reports/test_manifest.json] [--blur-threshold X]
"""
import argparse
import json
import random
from pathlib import Path

from .priority import review_priority


def run(manifest, blur_thr, trials=2000, seed=0):
    thr = manifest["threshold"]
    items = []
    for f in manifest["files"]:
        err = (f["score"] > thr) != bool(f["label"])
        pr, _ = review_priority(f["score"], thr, low_quality=f.get("blur", 1e9) < blur_thr)
        items.append({"priority": pr, "score": f["score"], "err": err})
    n, total_err = len(items), sum(i["err"] for i in items)
    by_priority = [i["err"] for i in sorted(items, key=lambda i: -i["priority"])]
    by_flagged = [i["err"] for i in sorted(items, key=lambda i: -i["score"])]   # highest score = most 'defective' first
    rng = random.Random(seed)
    out = {"n_images": n, "n_errors": total_err, "rows": []}
    share = lambda x: round(x / total_err, 3) if total_err else None
    for pct in (10, 20, 30, 50):
        k = max(1, round(n * pct / 100))
        rnd = 0.0
        flags = [i["err"] for i in items]
        for _ in range(trials):
            rng.shuffle(flags)
            rnd += sum(flags[:k])
        rnd /= trials
        pri, fl = sum(by_priority[:k]), sum(by_flagged[:k])
        out["rows"].append({"reviewed_pct": pct, "k": k,
                            "priority": pri, "flagged_first": fl, "random_mean": round(rnd, 2),
                            "share_priority": share(pri), "share_flagged_first": share(fl), "share_random": share(rnd)})
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--manifest", default="ml/reports/test_manifest.json")
    ap.add_argument("--blur-threshold", type=float, default=None)
    ap.add_argument("--out", default="ml/reports/priority_eval.md")
    a = ap.parse_args()
    manifest = json.loads(Path(a.manifest).read_text())
    blur_thr = a.blur_threshold
    if blur_thr is None:
        q = Path(a.manifest).parent.parent / "artifacts" / "quality.json"
        blur_thr = json.loads(q.read_text())["blur_threshold"] if q.exists() else 20.0
    r = run(manifest, blur_thr)
    lines = ["# Review-priority evaluation", "",
             f"{r['n_images']} held-out images, {r['n_errors']} model errors at the threshold.", "",
             "Errors found after reviewing the first k% of the queue (share of all errors in brackets):", "",
             "| reviewed | priority order | AI-flagged first | random (mean of 2000) |", "|---|---|---|---|"]
    for x in r["rows"]:
        lines.append(f"| first {x['reviewed_pct']}% ({x['k']} images) | {x['priority']} ({x['share_priority']}) | "
                     f"{x['flagged_first']} ({x['share_flagged_first']}) | {x['random_mean']} ({x['share_random']}) |")
    lines += ["", "Notes:",
              "- 'AI-flagged first' puts the highest anomaly scores first; it finds missed defects late because they were scored as normal.",
              f"- Only {r['n_errors']} errors exist on this split, so results are indicative, not precise. Single split, single model.",
              "- This set had no failed AI runs, so the 'AI failed' and 'low quality' priority rules are not exercised here.",
              "- Simulation of reviewer ordering, not a user study."]
    Path(a.out).write_text("\n".join(lines))
    print("\n".join(lines))


if __name__ == "__main__":
    main()