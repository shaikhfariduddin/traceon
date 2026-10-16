# Innovation: review-priority queue

**User problem.** Reviewers face a long queue and treat every image alike, so doubtful machine results and unusable photos wait as long as obvious ones, and AI mistakes are found late.

**Approach.** Each pending image gets a transparent 0-100 priority (`ml/priority.py`): failed/missing AI = 100; otherwise highest when the anomaly score is close to the decision threshold (the model is least reliable there); +25 for low image quality (blur check). The queue is sorted by it and shows the reason. It is a rule, not a learned model, and not a probability.

**How its value is tested.** `python -m ml.eval_priority` replays the held-out test set: the "errors" are the model's wrong decisions at the threshold. It reports how many errors a reviewer has found after the first 10/20/30/50% of images in priority order versus random order (mean of 2000 shuffles). Result file: `ml/reports/priority_eval.md`.
Report honestly whatever it shows (including if priority is no better than random for your data). Caveat: simulation, not a user study. A small real check for the demo: have two teammates review the same 20 images with and without priority order and compare time to find the AI errors.
