
import os
from typing import Optional
from urllib.parse import quote_plus

from pydantic_settings import BaseSettings, SettingsConfigDict


# Absolute path to the backend directory
BACKEND_DIR = os.path.dirname(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
)

# Absolute path to the repository root
PROJECT_ROOT = os.path.dirname(BACKEND_DIR)


class Settings(BaseSettings):
    PROJECT_NAME: str = "Tile Quality Inspection & Defect Tracking System"
    VERSION: str = "1.0.0"
    API_V1_STR: str = "/api"

    # PostgreSQL / Neon database
    DB_HOST: str = "localhost"
    DB_PORT: int = 5432
    DB_NAME: str = "tile_quality_db"
    DB_USER: str = "postgres"
    DB_PASSWORD: str = "admin@123"

    @property
    def SQLALCHEMY_DATABASE_URI(self) -> str:
        encoded_user = quote_plus(self.DB_USER)
        encoded_password = quote_plus(self.DB_PASSWORD)

        return (
            f"postgresql://{encoded_user}:{encoded_password}"
            f"@{self.DB_HOST}:{self.DB_PORT}/{self.DB_NAME}"
            "?sslmode=require"
        )

    # JWT authentication
    # Set a strong random SECRET_KEY in backend/.env for deployment.
    SECRET_KEY: str = "change-this-to-a-secure-random-secret"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 1440

    # File and model paths
    UPLOAD_DIR: str = os.path.join(BACKEND_DIR, "uploads")

    DATASET_PATH: str = r"c:\Users\PIYUSH\Downloads\tile\tile"

    # The trained model is stored in the repository-root model_artifacts folder.
    MODEL_PATH: str = os.path.join(
        PROJECT_ROOT,
        "model_artifacts",
        "tile_defect_classifier.pt",
    )

    # Generative AI API keys
    GEMINI_API_KEY: Optional[str] = None
    OPENAI_API_KEY: Optional[str] = None

    # Load environment variables from backend/.env
    model_config = SettingsConfigDict(
        env_file=os.path.join(BACKEND_DIR, ".env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )


settings = Settings()

# Create the upload directory if it does not exist.
os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
