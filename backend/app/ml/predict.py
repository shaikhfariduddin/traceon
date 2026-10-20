import os
import sys
import time
import numpy as np
from PIL import Image

import torch

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from app.ml.model import TileDefectClassifier
from app.ml.image_quality import assess_image_quality
from app.core.config import settings

_MODEL = None
_CLASSES = ["good", "crack", "glue_strip", "gray_stroke", "oil", "rough"]
_DEVICE = torch.device("cuda" if torch.cuda.is_available() else "cpu")

def get_model():
    global _MODEL
    if _MODEL is None:
        model_path = settings.MODEL_PATH
        if not os.path.exists(model_path):
            raise FileNotFoundError(f"Model artifact not found at {model_path}. Train the model first.")

        model = TileDefectClassifier(num_classes=len(_CLASSES)).to(_DEVICE)
        checkpoint = torch.load(model_path, map_location=_DEVICE)
        model.load_state_dict(checkpoint["model_state_dict"])
        model.eval()
        _MODEL = model
    return _MODEL

def predict_tile_image(image_path: str) -> dict:
    """
    Production inference function for tile visual quality inspection.
    Includes OpenCV/SciPy image quality checks, blur detection,
    illumination checks, and deep residual CNN classification.
    """
    t_start = time.time()

    # 1. Image Quality Assessment
    quality = assess_image_quality(image_path)
    if not quality["is_valid"]:
        return {
            "model_name": "TileDefectClassifier",
            "model_version": "v1.0.0",
            "predicted_class": "defective",
            "defect_type": "corrupted_image",
            "confidence_score": 0.0,
            "processing_time_ms": round((time.time() - t_start) * 1000.0, 2),
            "status": "failed",
            "error_message": quality["error"],
            "quality_assessment": quality,
            "review_required": True,
            "notes": "Image decoding failed. Manual inspection or re-upload required."
        }

    # 2. Model Inference
    try:
        model = get_model()

        # Consistent Preprocessing
        mean = np.array([0.485, 0.456, 0.406], dtype=np.float32)
        std = np.array([0.229, 0.224, 0.225], dtype=np.float32)

        with Image.open(image_path) as img:
            img = img.convert("RGB")
            img = img.resize((224, 224), Image.BILINEAR)
            img_np = np.array(img, dtype=np.float32) / 255.0
            img_np = (img_np - mean) / std
            img_tensor = torch.from_numpy(img_np.transpose((2, 0, 1))).unsqueeze(0).to(_DEVICE)

        with torch.no_grad():
            t_infer_start = time.time()
            logits = model(img_tensor)
            probs = torch.softmax(logits, dim=1).cpu().numpy()[0]
            pred_idx = int(np.argmax(probs))
            duration_ms = (time.time() - t_start) * 1000.0

        predicted_label = _CLASSES[pred_idx]
        confidence = float(probs[pred_idx])

        # Binary and Subtype mapping
        if pred_idx == 0:
            predicted_class = "good"
            defect_type = "none"
        else:
            predicted_class = "defective"
            defect_type = predicted_label

        # Uncertainty handling: if image quality is degraded or confidence is low (< 0.40)
        status = "completed"
        if quality["is_uncertain"] or confidence < 0.40:
            status = "uncertain"

        return {
            "model_name": "TileDefectClassifier",
            "model_version": "v1.0.0",
            "predicted_class": predicted_class,
            "defect_type": defect_type,
            "confidence_score": round(confidence, 4),
            "processing_time_ms": round(duration_ms, 2),
            "status": status,
            "error_message": None,
            "quality_assessment": quality,
            "review_required": True,
            "notes": "AI suggestion generated. Human review required for confirmation."
        }

    except Exception as e:
        return {
            "model_name": "TileDefectClassifier",
            "model_version": "v1.0.0",
            "predicted_class": "defective",
            "defect_type": "uncertain",
            "confidence_score": 0.0,
            "processing_time_ms": round((time.time() - t_start) * 1000.0, 2),
            "status": "failed",
            "error_message": str(e),
            "quality_assessment": quality,
            "review_required": True,
            "notes": f"Inference pipeline error: {str(e)}"
        }
