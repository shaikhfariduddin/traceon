# Tile anomaly detection - held-out evaluation

Model: `tile-resnet18-20261015` (backbone resnet18, MVTec AD category `tile`)

## Split
- Normal train images: 230 (fit 184, threshold calibration 46)
- Held-out test images: 117 - {'crack': 17, 'glue_strip': 18, 'good': 33, 'gray_stroke': 16, 'oil': 18, 'rough': 15}

## Result at the calibrated threshold (1.7653)
| | predicted good | predicted defective |
|---|---|---|
| actually good | 33 | 0 |
| actually defective | 8 | 76 |

Precision 1.000, recall 0.905, F1 0.950, image AUROC 0.998

## Recall by defect type
| type | n | detected | recall |
|---|---|---|---|
| crack | 17 | 17 | 1.00 |
| glue_strip | 18 | 18 | 1.00 |
| gray_stroke | 16 | 11 | 0.69 |
| oil | 18 | 18 | 1.00 |
| rough | 15 | 12 | 0.80 |

## Threshold sweep
| threshold | TN | FP | FN | TP | precision | recall |
|---|---|---|---|---|---|---|
| 1.236 | 0 | 33 | 0 | 84 | 0.72 | 1.00 |
| 1.412 | 7 | 26 | 0 | 84 | 0.76 | 1.00 |
| 1.589 | 30 | 3 | 0 | 84 | 0.97 | 1.00 |
| 1.765 | 33 | 0 | 8 | 76 | 1.00 | 0.90 |
| 1.942 | 33 | 0 | 24 | 60 | 1.00 | 0.71 |
| 2.118 | 33 | 0 | 36 | 48 | 1.00 | 0.57 |
| 2.295 | 33 | 0 | 55 | 29 | 1.00 | 0.35 |
| 2.648 | 33 | 0 | 64 | 20 | 1.00 | 0.24 |

## Uncertain band (+/-10% of threshold)
27 test images fall inside; 8 of the 8 errors are inside it (these are routed to human review).

## Misclassified test images
- `tile\test\gray_stroke\000.png` (gray_stroke), score 1.706
- `tile\test\gray_stroke\003.png` (gray_stroke), score 1.685
- `tile\test\gray_stroke\005.png` (gray_stroke), score 1.726
- `tile\test\gray_stroke\010.png` (gray_stroke), score 1.676
- `tile\test\gray_stroke\012.png` (gray_stroke), score 1.694
- `tile\test\rough\000.png` (rough), score 1.737
- `tile\test\rough\003.png` (rough), score 1.692
- `tile\test\rough\004.png` (rough), score 1.755

Scores are distances, not probabilities. MVTec AD is licensed CC BY-NC-SA 4.0 (non-commercial).