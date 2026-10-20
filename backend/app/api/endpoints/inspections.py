import os
import shutil
import uuid
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form
from sqlalchemy.orm import Session
from sqlalchemy import func, distinct
from typing import List, Optional
from datetime import datetime

from app.db.session import get_db
from app.models.inspection import Inspection
from app.models.inspection_image import InspectionImage
from app.models.model_result import ModelResult
from app.models.review import Review
from app.models.defect import Defect
from app.models.corrective_action import CorrectiveAction
from app.models.batch import Batch
from app.models.user import User
from app.models.audit import AuditHistory
from app.schemas.inspection import (
    InspectionCreate, InspectionResponse, InspectionDetailResponse,
    InspectionImageResponse, ModelResultResponse
)
from app.schemas.review import ReviewCreate, ReviewResponse
from app.api.deps import get_current_user, require_role
from app.core.config import settings
from app.ml.image_quality import calculate_sha256, assess_image_quality
from app.ml.predict import predict_tile_image
from app.services.audit_service import log_audit_event

router = APIRouter()

@router.get("", response_model=List[InspectionResponse])
def get_inspections(
    batch_id: Optional[int] = None,
    product_id: Optional[int] = None,
    status_filter: Optional[str] = None,
    sample_type: Optional[str] = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    query = db.query(Inspection)
    if batch_id:
        query = query.filter(Inspection.batch_id == batch_id)
    if product_id:
        query = query.join(Batch, Inspection.batch_id == Batch.id).filter(Batch.product_id == product_id)
    if status_filter:
        query = query.filter(Inspection.status == status_filter)
    if sample_type:
        query = query.filter(Inspection.sample_type == sample_type)

    inspections = query.order_by(Inspection.id.desc()).offset(skip).limit(limit).all()

    # Populate latest model result and latest review for list view
    results = []
    for insp in inspections:
        latest_res = db.query(ModelResult).filter(ModelResult.inspection_id == insp.id).order_by(ModelResult.id.desc()).first()
        latest_rev = db.query(Review).filter(Review.inspection_id == insp.id).order_by(Review.id.desc()).first()

        insp_dict = {
            "id": insp.id,
            "batch_id": insp.batch_id,
            "inspector_id": insp.inspector_id,
            "item_reference": insp.item_reference,
            "sample_type": insp.sample_type,
            "location": insp.location,
            "notes": insp.notes,
            "status": insp.status,
            "created_at": insp.created_at,
            "updated_at": insp.updated_at,
            "inspector": insp.inspector,
            "images": insp.images,
            "latest_model_result": latest_res,
            "latest_review": latest_rev
        }
        results.append(insp_dict)
    return results

@router.post("", response_model=InspectionResponse, status_code=status.HTTP_201_CREATED)
def create_inspection(
    inspection_in: InspectionCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["inspector", "supervisor", "manager"]))
):
    batch = db.query(Batch).filter(Batch.id == inspection_in.batch_id).first()
    if not batch:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Referenced batch not found")

    inspection = Inspection(
        batch_id=inspection_in.batch_id,
        inspector_id=current_user.id,
        item_reference=inspection_in.item_reference.strip(),
        sample_type=inspection_in.sample_type,
        location=inspection_in.location,
        notes=inspection_in.notes,
        status="submitted"
    )
    db.add(inspection)
    db.commit()
    db.refresh(inspection)

    log_audit_event(
        db=db,
        entity_name="inspection",
        entity_id=inspection.id,
        action="create",
        actor=current_user,
        reason=f"Registered inspection for item '{inspection.item_reference}' in batch '{batch.batch_code}'",
        details=inspection_in.model_dump()
    )
    return inspection

@router.get("/{inspection_id}", response_model=InspectionDetailResponse)
def get_inspection(
    inspection_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    insp = db.query(Inspection).filter(Inspection.id == inspection_id).first()
    if not insp:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Inspection record not found")

    batch = insp.batch
    product = batch.product if batch else None

    latest_res = db.query(ModelResult).filter(ModelResult.inspection_id == insp.id).order_by(ModelResult.id.desc()).first()
    latest_rev = db.query(Review).filter(Review.inspection_id == insp.id).order_by(Review.id.desc()).first()

    return {
        "id": insp.id,
        "batch_id": insp.batch_id,
        "inspector_id": insp.inspector_id,
        "item_reference": insp.item_reference,
        "sample_type": insp.sample_type,
        "location": insp.location,
        "notes": insp.notes,
        "status": insp.status,
        "created_at": insp.created_at,
        "updated_at": insp.updated_at,
        "inspector": insp.inspector,
        "images": insp.images,
        "model_results": insp.model_results,
        "reviews": insp.reviews,
        "defects": insp.defects,
        "latest_model_result": latest_res,
        "latest_review": latest_rev,
        "batch_code": batch.batch_code if batch else None,
        "product_name": product.name if product else None,
        "product_code": product.product_code if product else None
    }

@router.post("/{inspection_id}/images", response_model=List[InspectionImageResponse])
async def upload_inspection_images(
    inspection_id: int,
    files: List[UploadFile] = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["inspector", "supervisor", "manager"]))
):
    insp = db.query(Inspection).filter(Inspection.id == inspection_id).first()
    if not insp:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Inspection not found")

    allowed_extensions = {".png", ".jpg", ".jpeg", ".bmp", ".webp"}
    saved_images = []

    for file in files:
        ext = os.path.splitext(file.filename)[1].lower()
        if ext not in allowed_extensions:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Unsupported file format '{ext}'. Allowed: {', '.join(allowed_extensions)}"
            )

        # Generate collision-free safe file name
        safe_filename = f"insp_{inspection_id}_{uuid.uuid4().hex[:10]}{ext}"
        destination = os.path.join(settings.UPLOAD_DIR, safe_filename)

        with open(destination, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)

        file_size = os.path.getsize(destination)
        if file_size > 20 * 1024 * 1024: # 20MB limit
            os.remove(destination)
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"File '{file.filename}' exceeds 20MB limit."
            )

        file_hash = calculate_sha256(destination)
        quality = assess_image_quality(destination)

        image_record = InspectionImage(
            inspection_id=insp.id,
            file_path=f"/uploads/{safe_filename}",
            original_filename=file.filename,
            file_hash=file_hash,
            file_size=file_size,
            width=quality["width"],
            height=quality["height"],
            blur_score=quality["blur_score"],
            brightness_score=quality["brightness_score"],
            is_uncertain=quality["is_uncertain"],
            quality_notes=quality["quality_notes"]
        )
        db.add(image_record)
        saved_images.append(image_record)

    db.commit()
    for img in saved_images:
        db.refresh(img)

    log_audit_event(
        db=db,
        entity_name="inspection",
        entity_id=insp.id,
        action="upload_images",
        actor=current_user,
        reason=f"Uploaded {len(saved_images)} inspection photograph(s)",
        details={"count": len(saved_images), "filenames": [f.filename for f in files]}
    )
    return saved_images

@router.post("/{inspection_id}/analyze", response_model=List[ModelResultResponse])
def run_model_analysis(
    inspection_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["inspector", "supervisor", "manager"]))
):
    insp = db.query(Inspection).filter(Inspection.id == inspection_id).first()
    if not insp:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Inspection not found")

    images = db.query(InspectionImage).filter(InspectionImage.inspection_id == insp.id).all()
    if not images:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot analyze: No inspection images have been uploaded yet."
        )

    insp.status = "ai_processing"
    db.commit()

    model_results = []
    has_defect = False
    has_uncertain = False
    all_failed = True

    for img in images:
        # Resolve disk path from web path
        rel_path = img.file_path.replace("/uploads/", "")
        disk_path = os.path.join(settings.UPLOAD_DIR, rel_path)

        # If not in upload dir, check if it's an absolute path
        if not os.path.exists(disk_path) and os.path.exists(img.file_path):
            disk_path = img.file_path

        pred = predict_tile_image(disk_path)

        # Mark earlier model results for this image as not current
        db.query(ModelResult).filter(ModelResult.image_id == img.id).update({"is_current": False})

        res_record = ModelResult(
            inspection_id=insp.id,
            image_id=img.id,
            model_name=pred["model_name"],
            model_version=pred["model_version"],
            predicted_class=pred["predicted_class"],
            defect_type=pred["defect_type"],
            confidence_score=pred["confidence_score"],
            processing_time_ms=pred["processing_time_ms"],
            status=pred["status"],
            error_message=pred["error_message"],
            is_current=True
        )
        db.add(res_record)
        model_results.append(res_record)

        if pred["status"] != "failed":
            all_failed = False
        if pred["predicted_class"] == "defective":
            has_defect = True
        if pred["status"] == "uncertain":
            has_uncertain = True

    # Update inspection status safely based on model outcomes
    if all_failed:
        insp.status = "ai_failed"
    else:
        insp.status = "in_review"

    db.commit()
    for res in model_results:
        db.refresh(res)

    log_audit_event(
        db=db,
        entity_name="inspection",
        entity_id=insp.id,
        action="ai_analysis",
        actor=current_user,
        reason=f"Executed TileDefectClassifier inference on {len(model_results)} image(s)",
        details={
            "images_analyzed": len(model_results),
            "flagged_defective": has_defect,
            "uncertain": has_uncertain,
            "status": insp.status
        }
    )
    return model_results

@router.post("/{inspection_id}/review", response_model=ReviewResponse)
def submit_human_review(
    inspection_id: int,
    review_in: ReviewCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["inspector", "supervisor", "manager"]))
):
    insp = db.query(Inspection).filter(Inspection.id == inspection_id).first()
    if not insp:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Inspection not found")

    review = Review(
        inspection_id=insp.id,
        reviewer_id=current_user.id,
        review_decision=review_in.review_decision,
        confirmed_category=review_in.confirmed_category,
        notes=review_in.notes
    )
    db.add(review)

    # Workflow state transitions based on human decision
    if review_in.review_decision in ["confirmed_defect", "corrected_defect"]:
        insp.status = "confirmed_defect"
        category = review_in.confirmed_category or "defect_unspecified"
        desc = review_in.description or review_in.notes or f"Confirmed defect: {category}"

        # Check if defect record exists or create one
        existing_defect = db.query(Defect).filter(Defect.inspection_id == insp.id).first()
        if not existing_defect:
            defect = Defect(
                inspection_id=insp.id,
                defect_category=category,
                severity=review_in.severity or "minor",
                description=desc,
                status="open"
            )
            db.add(defect)
        else:
            existing_defect.defect_category = category
            existing_defect.status = "open"
            existing_defect.description = desc

    elif review_in.review_decision == "confirmed_good":
        insp.status = "confirmed_good"
    elif review_in.review_decision == "disputed":
        insp.status = "in_review" # Remains in review pending Manager resolution
    elif review_in.review_decision == "more_evidence_needed":
        insp.status = "in_review"

    db.commit()
    db.refresh(review)

    log_audit_event(
        db=db,
        entity_name="review",
        entity_id=review.id,
        action=f"review_{review_in.review_decision}",
        actor=current_user,
        reason=f"Human review recorded with decision '{review_in.review_decision}'",
        details=review_in.model_dump()
    )
    return review

@router.post("/{inspection_id}/resolve-dispute", response_model=ReviewResponse)
def resolve_dispute(
    inspection_id: int,
    resolution: ReviewCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["manager"])) # STRICT: Quality Manager only!
):
    insp = db.query(Inspection).filter(Inspection.id == inspection_id).first()
    if not insp:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Inspection not found")

    rev = Review(
        inspection_id=insp.id,
        reviewer_id=current_user.id,
        review_decision=resolution.review_decision,
        confirmed_category=resolution.confirmed_category,
        notes=f"[MANAGER DISPUTE RESOLUTION] {resolution.notes or ''}"
    )
    db.add(rev)

    if resolution.review_decision in ["confirmed_defect", "corrected_defect"]:
        insp.status = "confirmed_defect"
        defect = db.query(Defect).filter(Defect.inspection_id == insp.id).first()
        if not defect:
            defect = Defect(
                inspection_id=insp.id,
                defect_category=resolution.confirmed_category or "defect_unspecified",
                severity=resolution.severity or "major",
                description=f"Manager-confirmed defect: {resolution.confirmed_category}",
                status="open"
            )
            db.add(defect)
    else:
        insp.status = "confirmed_good"

    db.commit()
    db.refresh(rev)

    log_audit_event(
        db=db,
        entity_name="inspection",
        entity_id=insp.id,
        action="resolve_dispute",
        actor=current_user,
        reason=f"Manager resolved dispute with outcome: {resolution.review_decision}",
        details={"manager_id": current_user.id, "resolution": resolution.model_dump()}
    )
    return rev

@router.post("/{inspection_id}/reinspect", response_model=InspectionResponse, status_code=status.HTTP_201_CREATED)
def create_follow_up_inspection(
    inspection_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["inspector", "supervisor", "manager"]))
):
    source = db.query(Inspection).filter(Inspection.id == inspection_id).first()
    if not source:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Source inspection not found")

    follow_up = Inspection(
        batch_id=source.batch_id,
        inspector_id=current_user.id,
        item_reference=f"{source.item_reference}-R{inspection_id}",
        sample_type=source.sample_type,
        location=source.location,
        notes=f"Follow-up reinspection of {source.item_reference}. Upload new evidence; prior photographs remain on the original record.",
        status="submitted"
    )
    db.add(follow_up)
    db.commit()
    db.refresh(follow_up)

    latest_action = (
        db.query(CorrectiveAction)
        .join(Defect, CorrectiveAction.defect_id == Defect.id)
        .filter(Defect.inspection_id == source.id)
        .order_by(CorrectiveAction.id.desc())
        .first()
    )
    if latest_action:
        latest_action.follow_up_inspection_id = follow_up.id
        db.commit()

    log_audit_event(
        db=db,
        entity_name="inspection",
        entity_id=follow_up.id,
        action="reinspect",
        actor=current_user,
        reason=f"Created follow-up inspection for {source.item_reference}",
        details={"source_inspection_id": source.id, "follow_up_inspection_id": follow_up.id}
    )
    return follow_up


@router.get("/{inspection_id}/history")
def get_inspection_history(
    inspection_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    return db.query(AuditHistory)\
        .filter(AuditHistory.entity_name.in_(["inspection", "review", "defect", "action"]))\
        .filter(AuditHistory.entity_id == inspection_id)\
        .order_by(AuditHistory.timestamp.desc()).all()
