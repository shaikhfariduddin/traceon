# ML Model Evaluation Report â€” Tile Quality Inspection

**Model Architecture**: `TileDefectClassifier_ResNetLite` (PyTorch)
**Evaluated On**: Held-out Test Split (61 unseen tile images)
**Evaluation Date**: 2026-10-19 10:16:50 UTC

## 1. Executive Summary & Key Metrics

| Metric | Value | Description |
|---|---|---|
| **Binary Defect Detection Accuracy** | **82.0%** | Distinguishing Normal (`good`) from Defective tiles |
| **Binary Precision** | **67.9%** | Proportion of predicted defects that are real defects |
| **Binary Recall (Sensitivity)** | **90.5%** | Proportion of actual defects correctly flagged |
| **Binary F1-Score** | **77.6%** | Harmonic balance between Precision and Recall |
| **Multiclass Accuracy** | **80.3%** | Exact classification across all 6 classes |
| **Macro F1-Score** | **78.0%** | Unweighted mean F1 across all defect types |
| **Average Inference Latency** | **24.86 ms** | CPU inference time per tile photograph |

## 2. Confusion Matrix

### Binary Confusion Matrix (Row=Actual, Col=Predicted)

| Actual \ Predicted | Normal (Good) | Defective |
|---|---|---|
| **Normal (Good)** | 31 (True Normal) | 9 (False Alarm) |
| **Defective** | 2 (Missed Defect) | 19 (Detected Defect) |

### Multiclass Confusion Matrix

| Actual \ Predicted | good | crack | glue_strip | gray_stroke | oil | rough |
|---|---|---|---|---|---|---|
| **good** | 31 | 0 | 0 | 9 | 0 | 0 |
| **crack** | 0 | 4 | 0 | 0 | 0 | 0 |
| **glue_strip** | 0 | 0 | 4 | 1 | 0 | 0 |
| **gray_stroke** | 0 | 0 | 0 | 4 | 0 | 0 |
| **oil** | 0 | 0 | 0 | 0 | 5 | 0 |
| **rough** | 2 | 0 | 0 | 0 | 0 | 1 |

## 3. Representative Held-out Predictions

- âœ… File: `039.png` | Actual: **good** | Predicted: **good** (Confidence: 89.0%, 42.28 ms)
- âš ï¸ File: `004.png` | Actual: **good** | Predicted: **gray_stroke** (Confidence: 27.2%, 23.7 ms)
- âœ… File: `087.png` | Actual: **good** | Predicted: **good** (Confidence: 88.5%, 24.34 ms)
- âœ… File: `023.png` | Actual: **good** | Predicted: **good** (Confidence: 44.9%, 23.1 ms)
- âœ… File: `178.png` | Actual: **good** | Predicted: **good** (Confidence: 41.0%, 25.91 ms)
- âš ï¸ File: `040.png` | Actual: **good** | Predicted: **gray_stroke** (Confidence: 99.3%, 23.38 ms)
- âœ… File: `206.png` | Actual: **good** | Predicted: **good** (Confidence: 94.2%, 23.78 ms)
- âœ… File: `194.png` | Actual: **good** | Predicted: **good** (Confidence: 41.4%, 21.04 ms)

## 4. Operational Guardrails & Limitations
- **AI as Suggestion**: In accordance with the problem statement, all AI flags require human inspector confirmation.
- **Uncertainty & Quality Filter**: OpenCV Laplacian variance checks automatically detect blurred photographs (< 30.0) or overexposed/underexposed lighting and flag them as `uncertain` for manual review.
- **Manual Visual Checklist**: Visual installation irregularities such as uneven grout spacing, alignment errors, and chipped installation corners are recorded through the built-in manual inspection checklist.
