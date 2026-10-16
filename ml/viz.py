"""Heat-map overlay. Colours show the score relative to the decision threshold, not a probability."""
import numpy as np
from PIL import Image


def render_heatmap(img: Image.Image, amap: np.ndarray, threshold: float, max_side: int = 640) -> Image.Image:
    base = img.convert("RGB")
    scale = max_side / max(base.size)
    if scale < 1:
        base = base.resize((int(base.width * scale), int(base.height * scale)))
    m = Image.fromarray(amap.astype(np.float32), mode="F").resize(base.size, Image.BICUBIC)
    m = np.asarray(m, dtype=np.float32)
    alpha = np.clip((m / threshold - 0.8) / 0.6, 0.0, 1.0) * 0.65      # transparent below 80% of threshold
    arr = np.asarray(base, dtype=np.float32)
    red = np.array([225, 40, 35], dtype=np.float32)
    out = arr * (1 - alpha[..., None]) + red * alpha[..., None]
    return Image.fromarray(out.clip(0, 255).astype(np.uint8))
