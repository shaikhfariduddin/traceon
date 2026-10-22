
import os

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlalchemy import text

from app.core.config import settings
from app.db.session import engine
from app.api.endpoints import (
    auth,
    products,
    batches,
    inspections,
    defects,
    actions,
    dashboard,
    ai,
)

app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    description=(
        "End-to-End Tile Quality Inspection "
        "& Defect Tracking System"
    ),
    openapi_url=f"{settings.API_V1_STR}/openapi.json",
    docs_url=f"{settings.API_V1_STR}/docs",
    redoc_url=f"{settings.API_V1_STR}/redoc",
)

# CORS configuration
allowed_origins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:4173",
]

frontend_urls = os.getenv("FRONTEND_URL", "")
for url in frontend_urls.split(","):
    url = url.strip().rstrip("/")
    if url:
        allowed_origins.append(url)

app.add_middleware(
    CORSMiddleware,
    allow_origins=list(set(allowed_origins)),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Uploaded images
os.makedirs(settings.UPLOAD_DIR, exist_ok=True)

app.mount(
    "/uploads",
    StaticFiles(directory=settings.UPLOAD_DIR),
    name="uploads",
)

# API routes
app.include_router(
    auth.router,
    prefix=f"{settings.API_V1_STR}/auth",
    tags=["Authentication"],
)
app.include_router(
    products.router,
    prefix=f"{settings.API_V1_STR}/products",
    tags=["Products"],
)
app.include_router(
    batches.router,
    prefix=f"{settings.API_V1_STR}/batches",
    tags=["Batches"],
)
app.include_router(
    inspections.router,
    prefix=f"{settings.API_V1_STR}/inspections",
    tags=["Inspections"],
)
app.include_router(
    defects.router,
    prefix=f"{settings.API_V1_STR}/defects",
    tags=["Defects"],
)
app.include_router(
    actions.router,
    prefix=f"{settings.API_V1_STR}/actions",
    tags=["Corrective Actions"],
)
app.include_router(
    dashboard.router,
    prefix=f"{settings.API_V1_STR}/dashboard",
    tags=["Dashboard & Analytics"],
)
app.include_router(
    ai.router,
    prefix=f"{settings.API_V1_STR}/ai",
    tags=["Quality Intelligence GenAI"],
)


@app.get("/api/health", tags=["Health"])
def health_check():
    try:
        with engine.connect() as connection:
            connection.execute(text("SELECT 1"))

        return {
            "status": "healthy",
            "system": settings.PROJECT_NAME,
            "version": settings.VERSION,
            "database": "connected",
        }

    except Exception as exc:
        raise HTTPException(
            status_code=503,
            detail={
                "status": "unhealthy",
                "database": "disconnected",
                "message": "Database connection check failed.",
            },
        ) from exc


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "app.main:app",
        host="127.0.0.1",
        port=8000,
        reload=True,
    )
