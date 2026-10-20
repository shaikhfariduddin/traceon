import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.core.config import settings
from app.api.endpoints import auth, products, batches, inspections, defects, actions, dashboard, ai

app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    description="End-to-End Product Quality Inspection & Defect Tracking System for Tile Setting Use Case",
    openapi_url=f"{settings.API_V1_STR}/openapi.json",
    docs_url=f"{settings.API_V1_STR}/docs",
    redoc_url=f"{settings.API_V1_STR}/redoc"
)

# CORS Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount local uploads directory for secure static image viewing
os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=settings.UPLOAD_DIR), name="uploads")

# Include Routers
app.include_router(auth.router, prefix=f"{settings.API_V1_STR}/auth", tags=["Authentication"])
app.include_router(products.router, prefix=f"{settings.API_V1_STR}/products", tags=["Products"])
app.include_router(batches.router, prefix=f"{settings.API_V1_STR}/batches", tags=["Batches"])
app.include_router(inspections.router, prefix=f"{settings.API_V1_STR}/inspections", tags=["Inspections"])
app.include_router(defects.router, prefix=f"{settings.API_V1_STR}/defects", tags=["Defects"])
app.include_router(actions.router, prefix=f"{settings.API_V1_STR}/actions", tags=["Corrective Actions"])
app.include_router(dashboard.router, prefix=f"{settings.API_V1_STR}/dashboard", tags=["Dashboard & Analytics"])
app.include_router(ai.router, prefix=f"{settings.API_V1_STR}/ai", tags=["Quality Intelligence GenAI"])

@app.get("/api/health")
def health_check():
    return {
        "status": "healthy",
        "system": settings.PROJECT_NAME,
        "version": settings.VERSION,
        "database": "connected",
        "model": "TileDefectClassifier_v1.0.0"
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="127.0.0.1", port=8000, reload=True)
