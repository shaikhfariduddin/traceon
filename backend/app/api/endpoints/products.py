from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Optional
from app.db.session import get_db
from app.models.product import Product
from app.models.user import User
from app.schemas.product import ProductCreate, ProductUpdate, ProductResponse
from app.api.deps import get_current_user, require_role
from app.services.audit_service import log_audit_event

router = APIRouter()

@router.get("", response_model=List[ProductResponse])
def get_products(
    include_archived: bool = True,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    query = db.query(Product)
    if not include_archived:
        query = query.filter(Product.is_archived == False)
    return query.order_by(Product.id.desc()).all()

@router.post("", response_model=ProductResponse, status_code=status.HTTP_201_CREATED)
def create_product(
    product_in: ProductCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["inspector", "supervisor", "manager"]))
):
    existing = db.query(Product).filter(Product.product_code == product_in.product_code).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Product with code '{product_in.product_code}' already exists."
        )

    product = Product(**product_in.model_dump())
    db.add(product)
    db.commit()
    db.refresh(product)

    log_audit_event(
        db=db,
        entity_name="product",
        entity_id=product.id,
        action="create",
        actor=current_user,
        reason=f"Registered product line {product.product_code}",
        details=product_in.model_dump()
    )
    return product

@router.get("/{product_id}", response_model=ProductResponse)
def get_product(
    product_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found")
    return product

@router.patch("/{product_id}", response_model=ProductResponse)
def update_product(
    product_id: int,
    product_in: ProductUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["supervisor", "manager"]))
):
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found")

    update_data = product_in.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(product, field, value)

    db.commit()
    db.refresh(product)

    log_audit_event(
        db=db,
        entity_name="product",
        entity_id=product.id,
        action="update",
        actor=current_user,
        details=update_data
    )
    return product

@router.post("/{product_id}/archive", response_model=ProductResponse)
def archive_product(
    product_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["manager"]))
):
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found")

    product.is_archived = True
    db.commit()
    db.refresh(product)

    log_audit_event(
        db=db,
        entity_name="product",
        entity_id=product.id,
        action="archive",
        actor=current_user,
        reason="Product line archived by Quality Manager. Historical records preserved."
    )
    return product
