"""Innovation: review-priority score.

Reviewers see the least certain / least reliable machine results first. The score is a transparent rule
(not a learned model and not a probability): 0-100, higher = review sooner."""


def review_priority(score, threshold, low_quality=False, failed=False, no_run=False):
    """Return (priority 0-100, human-readable reason)."""
    if failed:
        return 100.0, "AI unavailable or failed - manual review needed"
    if no_run or score is None or not threshold:
        return 90.0, "No AI result yet - manual review needed"
    distance = abs(score / threshold - 1.0)               # 0 = exactly on the decision threshold
    p = 100.0 * max(0.0, 1.0 - distance / 0.5)            # >=50% away from threshold -> 0
    reason = "Score close to the decision threshold" if p >= 50 else "Clear machine result"
    if low_quality:
        p = min(100.0, p + 25.0)
        reason = "Low image quality - machine result less reliable"
    return round(p, 1), reason
