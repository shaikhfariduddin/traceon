# Review-priority evaluation

117 held-out images, 8 model errors at the threshold.

Errors found after reviewing the first k% of the queue (share of all errors in brackets):

| reviewed | priority order | AI-flagged first | random (mean of 2000) |
|---|---|---|---|
| first 10% (12 images) | 4 (0.5) | 0 (0.0) | 0.82 (0.103) |
| first 20% (23 images) | 8 (1.0) | 0 (0.0) | 1.61 (0.201) |
| first 30% (35 images) | 8 (1.0) | 0 (0.0) | 2.38 (0.297) |
| first 50% (58 images) | 8 (1.0) | 0 (0.0) | 3.93 (0.491) |

Notes:
- 'AI-flagged first' puts the highest anomaly scores first; it finds missed defects late because they were scored as normal.
- Only 8 errors exist on this split, so results are indicative, not precise. Single split, single model.
- This set had no failed AI runs, so the 'AI failed' and 'low quality' priority rules are not exercised here.
- Simulation of reviewer ordering, not a user study.