import os
import sys
import json
import time
import numpy as np
from PIL import Image

import torch
from sklearn.metrics import classification_report, confusion_matrix, precision_recall_fscore_support, accuracy_score

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from app.ml.model import TileDefectClassifier
from app.ml.train import TileDataset

def evaluate_model(
    manifest_path: str = r"c:\Users\PIYUSH\Desktop\Defect Tracking\model_artifacts\dataset_manifest.json",
    model_path: str = r"c:\Users\PIYUSH\Desktop\Defect Tracking\model_artifacts\tile_defect_classifier.pt",
    output_json: str = r"c:\Users\PIYUSH\Desktop\Defect Tracking\model_artifacts\evaluation_results.json",
    doc_path: str = r"c:\Users\PIYUSH\Desktop\Defect Tracking\docs\ml-evaluation.md"
):
    print("Loading test split from manifest...")
    with open(manifest_path, "r", encoding="utf-8") as f:
        manifest = json.load(f)

    test_items = manifest["splits"]["test"]
    classes = manifest["classes"]
    test_dataset = TileDataset(test_items, is_train=False)

    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    print(f"Evaluating on device: {device}")

    model = TileDefectClassifier(num_classes=len(classes)).to(device)
    checkpoint = torch.load(model_path, map_location=device)
    model.load_state_dict(checkpoint["model_state_dict"])
    model.eval()

    y_true = []
    y_pred = []
    probabilities = []
    inference_times_ms = []
    sample_records = []

    with torch.no_grad():
        for i in range(len(test_dataset)):
            img_tensor, label = test_dataset[i]
            img_tensor = img_tensor.unsqueeze(0).to(device)

            t0 = time.time()
            logits = model(img_tensor)
            probs = torch.softmax(logits, dim=1).cpu().numpy()[0]
            pred_idx = int(np.argmax(probs))
            duration_ms = (time.time() - t0) * 1000.0

            inference_times_ms.append(duration_ms)
            true_idx = int(label.item())

            y_true.append(true_idx)
            y_pred.append(pred_idx)
            probabilities.append(float(probs[pred_idx]))

            sample_records.append({
                "image_path": test_items[i]["path"],
                "true_class": classes[true_idx],
                "pred_class": classes[pred_idx],
                "confidence": round(float(probs[pred_idx]), 4),
                "is_correct": true_idx == pred_idx,
                "latency_ms": round(duration_ms, 2)
            })

    # Metrics
    multiclass_acc = float(accuracy_score(y_true, y_pred))
    p_macro, r_macro, f1_macro, _ = precision_recall_fscore_support(y_true, y_pred, average="macro", zero_division=0)
    p_weighted, r_weighted, f1_weighted, _ = precision_recall_fscore_support(y_true, y_pred, average="weighted", zero_division=0)
    cm = confusion_matrix(y_true, y_pred, labels=list(range(len(classes)))).tolist()

    # Binary Metrics (good vs defective)
    y_true_bin = [0 if y == 0 else 1 for y in y_true]
    y_pred_bin = [0 if y == 0 else 1 for y in y_pred]
    bin_acc = float(accuracy_score(y_true_bin, y_pred_bin))
    bin_p, bin_r, bin_f1, _ = precision_recall_fscore_support(y_true_bin, y_pred_bin, average="binary", zero_division=0)
    bin_cm = confusion_matrix(y_true_bin, y_pred_bin, labels=[0, 1]).tolist()

    avg_latency = float(np.mean(inference_times_ms))

    eval_results = {
        "model_version": "v1.0.0",
        "evaluation_timestamp": time.strftime("%Y-%m-%d %H:%M:%S UTC", time.gmtime()),
        "test_samples_count": len(test_items),
        "classes": classes,
        "metrics": {
            "multiclass_accuracy": round(multiclass_acc, 4),
            "binary_accuracy": round(bin_acc, 4),
            "macro_precision": round(float(p_macro), 4),
            "macro_recall": round(float(r_macro), 4),
            "macro_f1": round(float(f1_macro), 4),
            "weighted_f1": round(float(f1_weighted), 4),
            "binary_precision": round(float(bin_p), 4),
            "binary_recall": round(float(bin_r), 4),
            "binary_f1": round(float(bin_f1), 4),
            "average_latency_ms": round(avg_latency, 2)
        },
        "confusion_matrix_multiclass": cm,
        "confusion_matrix_binary": bin_cm,
        "sample_records": sample_records
    }

    os.makedirs(os.path.dirname(output_json), exist_ok=True)
    with open(output_json, "w", encoding="utf-8") as f:
        json.dump(eval_results, f, indent=2)
    print(f"Saved evaluation results to {output_json}")

    # Write Markdown documentation
    os.makedirs(os.path.dirname(doc_path), exist_ok=True)
    with open(doc_path, "w", encoding="utf-8") as f:
        f.write("# ML Model Evaluation Report â€” Tile Quality Inspection\n\n")
        f.write(f"**Model Architecture**: `TileDefectClassifier_ResNetLite` (PyTorch)\n")
        f.write(f"**Evaluated On**: Held-out Test Split ({len(test_items)} unseen tile images)\n")
        f.write(f"**Evaluation Date**: {eval_results['evaluation_timestamp']}\n\n")

        f.write("## 1. Executive Summary & Key Metrics\n\n")
        f.write("| Metric | Value | Description |\n")
        f.write("|---|---|---|\n")
        f.write(f"| **Binary Defect Detection Accuracy** | **{bin_acc * 100:.1f}%** | Distinguishing Normal (`good`) from Defective tiles |\n")
        f.write(f"| **Binary Precision** | **{bin_p * 100:.1f}%** | Proportion of predicted defects that are real defects |\n")
        f.write(f"| **Binary Recall (Sensitivity)** | **{bin_r * 100:.1f}%** | Proportion of actual defects correctly flagged |\n")
        f.write(f"| **Binary F1-Score** | **{bin_f1 * 100:.1f}%** | Harmonic balance between Precision and Recall |\n")
        f.write(f"| **Multiclass Accuracy** | **{multiclass_acc * 100:.1f}%** | Exact classification across all 6 classes |\n")
        f.write(f"| **Macro F1-Score** | **{f1_macro * 100:.1f}%** | Unweighted mean F1 across all defect types |\n")
        f.write(f"| **Average Inference Latency** | **{avg_latency:.2f} ms** | CPU inference time per tile photograph |\n\n")

        f.write("## 2. Confusion Matrix\n\n")
        f.write("### Binary Confusion Matrix (Row=Actual, Col=Predicted)\n\n")
        f.write("| Actual \\ Predicted | Normal (Good) | Defective |\n")
        f.write("|---|---|---|\n")
        f.write(f"| **Normal (Good)** | {bin_cm[0][0]} (True Normal) | {bin_cm[0][1]} (False Alarm) |\n")
        f.write(f"| **Defective** | {bin_cm[1][0]} (Missed Defect) | {bin_cm[1][1]} (Detected Defect) |\n\n")

        f.write("### Multiclass Confusion Matrix\n\n")
        f.write("| Actual \\ Predicted | " + " | ".join(classes) + " |\n")
        f.write("|---|" + "|".join(["---"] * len(classes)) + "|\n")
        for i, row in enumerate(cm):
            f.write(f"| **{classes[i]}** | " + " | ".join(str(val) for val in row) + " |\n")
        f.write("\n")

        f.write("## 3. Representative Held-out Predictions\n\n")
        for sample in sample_records[:8]:
            status_emoji = "âœ…" if sample["is_correct"] else "âš ï¸"
            f.write(f"- {status_emoji} File: `{os.path.basename(sample['image_path'])}` | Actual: **{sample['true_class']}** | Predicted: **{sample['pred_class']}** (Confidence: {sample['confidence'] * 100:.1f}%, {sample['latency_ms']} ms)\n")

        f.write("\n## 4. Operational Guardrails & Limitations\n")
        f.write("- **AI as Suggestion**: In accordance with the problem statement, all AI flags require human inspector confirmation.\n")
        f.write("- **Uncertainty & Quality Filter**: OpenCV Laplacian variance checks automatically detect blurred photographs (< 30.0) or overexposed/underexposed lighting and flag them as `uncertain` for manual review.\n")
        f.write("- **Manual Visual Checklist**: Visual installation irregularities such as uneven grout spacing, alignment errors, and chipped installation corners are recorded through the built-in manual inspection checklist.\n")

    print(f"Generated evaluation markdown report at {doc_path}")
    return eval_results

if __name__ == "__main__":
    evaluate_model()
