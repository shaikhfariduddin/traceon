import sys
import os
from datetime import datetime, timezone, timedelta

# Ensure backend directory is in sys.path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from app.db.session import engine, SessionLocal, Base
from app.models import (
    User, Product, Batch, Inspection, InspectionImage,
    ModelResult, Review, Defect, CorrectiveAction, BatchDecision, AuditHistory
)
from app.core.security import get_password_hash

def init_db():
    print("Creating all tables in PostgreSQL...")
    Base.metadata.create_all(bind=engine)
    print("Tables created successfully.")

    db = SessionLocal()
    try:
        # 1. Seed Demo Users if not exist
        users_data = [
            {
                "username": "inspector",
                "email": "inspector@tilequality.com",
                "full_name": "Rajesh Kumar (Lead Inspector)",
                "role": "inspector",
                "password": "inspector123"
            },
            {
                "username": "supervisor",
                "email": "supervisor@tilequality.com",
                "full_name": "Priya Sharma (Production Supervisor)",
                "role": "supervisor",
                "password": "supervisor123"
            },
            {
                "username": "manager",
                "email": "manager@tilequality.com",
                "full_name": "Vikram Malhotra (Quality Assurance Manager)",
                "role": "manager",
                "password": "manager123"
            }
        ]

        for u in users_data:
            existing = db.query(User).filter(User.username == u["username"]).first()
            if not existing:
                user = User(
                    username=u["username"],
                    email=u["email"],
                    full_name=u["full_name"],
                    role=u["role"],
                    hashed_password=get_password_hash(u["password"]),
                    is_active=True
                )
                db.add(user)
                print(f"Created demo user: {u['username']} ({u['role']})")
        db.commit()

        # 2. Seed Realistic Tile Products
        products_data = [
            {
                "product_code": "PROD-CER-01",
                "name": "Porcelain Gris Satin Finish 600x600",
                "tile_type": "Porcelain",
                "dimensions": "600x600 mm",
                "finish": "Satin",
                "material": "Vitrified Porcelain",
                "is_archived": False
            },
            {
                "product_code": "PROD-CER-02",
                "name": "Monocottura Ceramic Wall Tile 300x600",
                "tile_type": "Ceramic",
                "dimensions": "300x600 mm",
                "finish": "Glossy Glazed",
                "material": "Glazed Ceramic",
                "is_archived": False
            },
            {
                "product_code": "PROD-CER-03",
                "name": "Heavy Duty Industrial Floor Tile 400x400",
                "tile_type": "Vitrified",
                "dimensions": "400x400 mm",
                "finish": "Textured Anti-Slip",
                "material": "Full Body Vitrified",
                "is_archived": False
            },
            {
                "product_code": "PROD-CER-LEGACY",
                "name": "Rustic Terracotta Paver 200x200 (Archived Line)",
                "tile_type": "Terracotta",
                "dimensions": "200x200 mm",
                "finish": "Natural Matte",
                "material": "Earthen Clay",
                "is_archived": True
            }
        ]

        for p in products_data:
            existing = db.query(Product).filter(Product.product_code == p["product_code"]).first()
            if not existing:
                prod = Product(**p)
                db.add(prod)
                print(f"Created demo product: {p['product_code']}")
        db.commit()

        # 3. Seed Realistic Batches
        p1 = db.query(Product).filter(Product.product_code == "PROD-CER-01").first()
        p2 = db.query(Product).filter(Product.product_code == "PROD-CER-02").first()
        p3 = db.query(Product).filter(Product.product_code == "PROD-CER-03").first()

        batches_data = [
            {
                "product_id": p1.id,
                "batch_code": "B-101",
                "production_date": datetime.now(timezone.utc) - timedelta(days=12),
                "quantity": 2500,
                "supplier": "Ceramica Industries Plant 1",
                "status": "released"
            },
            {
                "product_id": p1.id,
                "batch_code": "B-102",
                "production_date": datetime.now(timezone.utc) - timedelta(days=6),
                "quantity": 3000,
                "supplier": "Ceramica Industries Plant 1",
                "status": "in_inspection"
            },
            {
                "product_id": p2.id,
                "batch_code": "B-103",
                "production_date": datetime.now(timezone.utc) - timedelta(days=4),
                "quantity": 1800,
                "supplier": "GlazeTech S.A.",
                "status": "in_inspection"
            },
            {
                "product_id": p3.id,
                "batch_code": "B-104",
                "production_date": datetime.now(timezone.utc) - timedelta(days=2),
                "quantity": 4200,
                "supplier": "Vitrified Pro Ltd.",
                "status": "on_hold"
            }
        ]

        for b in batches_data:
            existing = db.query(Batch).filter(Batch.batch_code == b["batch_code"]).first()
            if not existing:
                batch = Batch(**b)
                db.add(batch)
                print(f"Created demo batch: {b['batch_code']}")
        db.commit()

        # 4. Add Manager Decision for B-101 (Release) and B-104 (Hold)
        manager = db.query(User).filter(User.username == "manager").first()
        b101 = db.query(Batch).filter(Batch.batch_code == "B-101").first()
        b104 = db.query(Batch).filter(Batch.batch_code == "B-104").first()

        if b101 and not db.query(BatchDecision).filter(BatchDecision.batch_id == b101.id).first():
            dec1 = BatchDecision(
                batch_id=b101.id,
                manager_id=manager.id,
                decision="release",
                reason="Pass rate 99.4% across 45 sampled tiles; conforms to ISO 13006 / EN 14411 standard."
            )
            db.add(dec1)

        if b104 and not db.query(BatchDecision).filter(BatchDecision.batch_id == b104.id).first():
            dec2 = BatchDecision(
                batch_id=b104.id,
                manager_id=manager.id,
                decision="hold",
                reason="Recurring surface crack anomalies detected on Kiln 2 output. Corrective action ACT-001 issued."
            )
            db.add(dec2)
        db.commit()

        # Add initial audit records
        if not db.query(AuditHistory).first():
            db.add(AuditHistory(
                entity_name="system",
                entity_id=1,
                action="system_init",
                actor_id=manager.id,
                actor_name=manager.full_name,
                actor_role=manager.role,
                reason="Initial system seed data created with verified products and batches.",
                details={"status": "initialized", "products_count": len(products_data), "batches_count": len(batches_data)}
            ))
            db.commit()

        print("Database initialization and seed complete!")

    finally:
        db.close()

if __name__ == "__main__":
    init_db()
