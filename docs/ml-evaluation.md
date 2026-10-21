# ML Model Evaluation — Traceon

## 1. Evaluation Overview

- **Model:** `TileDefectClassifier_ResNetLite`
- **Framework:** PyTorch
- **Evaluation dataset:** 61 held-out tile images
- **Evaluation date:** 2026-10-19
- **Inference environment:** CPU

## 2. Performance Metrics

| Metric | Result |
|---|---:|
| Binary defect detection accuracy | 82.0% |
| Binary precision | 67.9% |
| Binary recall | 90.5% |
| Binary F1-score | 77.6% |
| Six-class classification accuracy | 80.3% |
| Macro F1-score | 78.0% |
| Average inference latency | 24.86 ms/image |

Binary detection distinguishes normal (`good`) tiles from defective tiles. Multiclass classification predicts one of six classes: `good`, `crack`, `glue_strip`, `gray_stroke`, `oil`, and `rough`.

## 3. Confusion Matrices

### Binary Classification

Rows represent actual labels; columns represent predicted labels.

| Actual | Predicted Normal | Predicted Defective |
|---|---:|---:|
| Normal | 31 | 9 |
| Defective | 2 | 19 |

The model detected 19 of 21 defective images but incorrectly flagged 9 of 40 normal images. This indicates high defect recall, with false positives remaining an important limitation.

### Multiclass Classification

| Actual \ Predicted | good | crack | glue_strip | gray_stroke | oil | rough |
|---|---:|---:|---:|---:|---:|---:|
| good | 31 | 0 | 0 | 9 | 0 | 0 |
| crack | 0 | 4 | 0 | 0 | 0 | 0 |
| glue_strip | 0 | 0 | 4 | 1 | 0 | 0 |
| gray_stroke | 0 | 0 | 0 | 4 | 0 | 0 |
| oil | 0 | 0 | 0 | 0 | 5 | 0 |
| rough | 2 | 0 | 0 | 0 | 0 | 1 |

The matrix highlights confusion between normal tiles and `gray_stroke`, as well as errors involving `rough` tiles. The small number of examples in some classes means per-class performance should be interpreted cautiously.

## 4. Representative Predictions

Representative held-out predictions show both correct classifications and errors.

- **Correct example:** `039.png` — actual `good`, predicted `good`, confidence 89.0%.
- **False positive:** `004.png` — actual `good`, predicted `gray_stroke`, confidence 27.2%.
- **High-confidence false positive:** `040.png` — actual `good`, predicted `gray_stroke`, confidence 99.3%.

These examples demonstrate why confidence scores alone cannot guarantee correctness and why human review remains necessary.

## 5. Operational Safeguards

- **Human-in-the-loop:** ML predictions are recommendations and require human review before a defect is confirmed.
- **Image-quality checks:** OpenCV-based blur and lighting checks flag potentially unsuitable photographs for manual review, according to configured thresholds.
- **Manual inspection checklist:** Installation-related issues, such as uneven grout spacing, alignment errors, and chipped installation corners, are recorded through manual inspection where supported.
- **Traceability:** Predictions and review decisions should remain separately recorded so earlier results and human decisions can be audited.

## 6. Limitations and Conclusion

The model achieved 82.0% binary accuracy and 90.5% binary recall on the reported held-out test split. However, the 67.9% precision indicates that some normal tiles are incorrectly flagged as defective.

The evaluation covers only 61 images and does not establish performance across all tile types, lighting conditions, production batches, or real-world environments. Further testing on larger, representative datasets is required before relying on the model for production quality decisions.

**Conclusion:** The current model demonstrates promising defect-screening capability for Traceon, with human verification and image-quality checks providing essential safeguards against incorrect automated predictions.
