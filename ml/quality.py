"""Image-quality check shared by the backend and the training script (NumPy + Pillow only)."""
import numpy as np
from PIL import Image


def blur_score(img: Image.Image) -> float:
    """Variance of the Laplacian on a 256x256 grey copy. Lower = blurrier.
    This is a heuristic; tile textures differ, so train.py derives a threshold from normal training images."""
    g = np.asarray(img.convert("L").resize((256, 256)), dtype=np.float64)
    lap = 4 * g[1:-1, 1:-1] - g[:-2, 1:-1] - g[2:, 1:-1] - g[1:-1, :-2] - g[1:-1, 2:]
    return float(lap.var())
