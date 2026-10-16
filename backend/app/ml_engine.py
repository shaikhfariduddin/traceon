"""Thin, failure-tolerant wrapper around the trained tile model.

If PyTorch or the model file is missing, predict() raises ModelUnavailable. The service layer stores that as a
FAILED model run (kept in history) and the image goes to manual review - the app never invents a prediction."""
from pathlib import Path

from . import config


class ModelUnavailable(Exception):
    pass


_model = None


def _load():
    global _model
    if _model is not None:
        return _model
    try:
        import torch  # noqa: F401
    except Exception as exc:
        raise ModelUnavailable(f"PyTorch is not installed ({exc.__class__.__name__}).")
    if not Path(config.MODEL_PATH).exists():
        raise ModelUnavailable("Model file not found. Train it with ml/train.py (see README).")
    from ml.tileml import TileAnomalyModel
    _model = TileAnomalyModel.load(config.MODEL_PATH)
    return _model


def status() -> dict:
    try:
        m = _load()
        return {"available": True, "model_name": m.meta.get("name"), "model_version": m.meta.get("version"),
                "threshold": m.threshold, "band": m.band, "reason": None}
    except ModelUnavailable as exc:
        return {"available": False, "reason": str(exc)}
    except Exception as exc:
        return {"available": False, "reason": f"Model failed to load: {exc}"}


def predict(image_path: Path, heatmap_path: Path) -> dict:
    return _load().predict_file(image_path, heatmap_path)
