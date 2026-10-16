"""Central configuration. Everything can be overridden with environment variables (see .env.example)."""
import json
import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]          # repository root
if str(ROOT) not in sys.path:                        # lets the backend import the shared `ml` package
    sys.path.insert(0, str(ROOT))

DATA_DIR = Path(os.getenv("TRACEON_DATA_DIR", ROOT / "data"))
DB_PATH = Path(os.getenv("TRACEON_DB", DATA_DIR / "traceon.db"))
UPLOAD_DIR = Path(os.getenv("TRACEON_UPLOAD_DIR", DATA_DIR / "uploads"))
MODEL_PATH = Path(os.getenv("TRACEON_MODEL", ROOT / "ml" / "artifacts" / "tile_patchcore.pt"))
QUALITY_PATH = Path(os.getenv("TRACEON_QUALITY", ROOT / "ml" / "artifacts" / "quality.json"))

SECRET_KEY = os.getenv("TRACEON_SECRET", "dev-only-change-me")
TOKEN_TTL_SECONDS = int(os.getenv("TRACEON_TOKEN_TTL", str(8 * 3600)))

MAX_UPLOAD_BYTES = int(os.getenv("TRACEON_MAX_UPLOAD_MB", "10")) * 1024 * 1024
MAX_PIXELS = 40_000_000
ALLOWED_FORMATS = {"JPEG": ("image/jpeg", ".jpg"), "PNG": ("image/png", ".png"), "BMP": ("image/bmp", ".bmp")}

# Heuristic blur limit (variance of Laplacian). train.py writes a data-derived value to quality.json.
DEFAULT_BLUR_THRESHOLD = float(os.getenv("TRACEON_BLUR_THRESHOLD", "20"))


def blur_threshold() -> float:
    try:
        return float(json.loads(QUALITY_PATH.read_text())["blur_threshold"])
    except Exception:
        return DEFAULT_BLUR_THRESHOLD


# Optional hosted LLM for the GenAI feature. Without a key the app uses its grounded template mode.
ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY", "")
ANTHROPIC_MODEL = os.getenv("ANTHROPIC_MODEL", "claude-sonnet-5-5")
CORS_ORIGINS = [o for o in os.getenv("TRACEON_CORS", "http://localhost:5173,http://127.0.0.1:5173").split(",") if o]
