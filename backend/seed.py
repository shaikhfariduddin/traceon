"""Create FICTIONAL demo data: users, a tile product, batches, inspections, reviews, defects, actions.

    python backend/seed.py --reset                         # synthetic placeholder tile photos (UI/testing only)
    python backend/seed.py --reset --mvtec /data/mvtec_anomaly_detection   # real held-out MVTec AD tile test images

Run ml/train.py first if you want real AI results; otherwise every image gets a stored FAILED AI run and goes to
manual review (use "Retry AI" in the UI after training). Demo password for all accounts: demo1234.
The reviews/decisions below are scripted demo records, not evidence about real tiles."""
import argparse
import io
import random
import sys
from datetime import date, timedelta
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw

sys.path.insert(0, str(Path(__file__).resolve().parent))
from app import config, db, ml_engine, services  # noqa: E402

PASSWORD = "demo1234"


def synthetic_tile(seed, defect=None):
    """Clearly synthetic stand-in: speckled glaze + optional drawn flaw. NOT a substitute for the real dataset."""
    rng = np.random.default_rng(seed)
    base = np.clip(rng.normal(205, 6, (256, 256, 3)) + np.array([0, 4, 8]), 0, 255).astype("uint8")
    img = Image.fromarray(base)
    d = ImageDraw.Draw(img)
    if defect == "crack":
        x, y = int(rng.integers(30, 120)), int(rng.integers(20, 80))
        pts = [(x, y)]
        for _ in range(7):
            x, y = x + int(rng.integers(8, 28)), y + int(rng.integers(10, 30))
            pts.append((x, y))
        d.line(pts, fill=(60, 55, 52), width=2)
    elif defect == "oil_stain":
        x, y = int(rng.integers(60, 190)), int(rng.integers(60, 190))
        d.ellipse([x, y, x + 40, y + 28], fill=(150, 140, 120))
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()


def load_pool(mvtec):
    """Returns {'good': [bytes...], 'crack': [...], ...} with a ground-truth tag per image."""
    pool = {"good": [], "defect": []}
    if mvtec:
        test = Path(mvtec) / "tile" / "test"
        for sub in sorted(p for p in test.iterdir() if p.is_dir()):
            key = "good" if sub.name == "good" else "defect"
            pool[key] += [(f.read_bytes(), sub.name) for f in sorted(sub.glob("*.png"))]
        return pool, "MVTec AD tile test image (held out)"
    pool["good"] = [(synthetic_tile(i), "good") for i in range(30)]
    pool["defect"] = [(synthetic_tile(100 + i, "crack" if i % 2 else "oil_stain"), "crack" if i % 2 else "oil_stain") for i in range(14)]
    return pool, "[synthetic placeholder]"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--reset", action="store_true", help="delete the existing database and uploads first")
    ap.add_argument("--mvtec", help="MVTec AD root folder to take real test images from")
    a = ap.parse_args()
    if a.reset:
        for p in (config.DB_PATH, Path(str(config.DB_PATH) + "-wal"), Path(str(config.DB_PATH) + "-shm")):
            p.unlink(missing_ok=True)
        if config.UPLOAD_DIR.exists():
            for f in config.UPLOAD_DIR.glob("*"):
                f.unlink()
    conn = db.connect()
    db.init_db(conn)
    if conn.execute("SELECT COUNT(*) FROM users").fetchone()[0]:
        sys.exit("Database already has data. Re-run with --reset to start clean.")
    rnd = random.Random(7)
    pool, source = load_pool(a.mvtec)
    rnd.shuffle(pool["good"])
    rnd.shuffle(pool["defect"])

    mk = lambda u, n, r: services.get_user(conn, services.create_user(conn, u, n, r, PASSWORD))
    mgr, ins1, ins2 = mk("manager", "Meera Kulkarni (Quality manager)", "manager"), mk("inspector", "Rohan Deshmukh (Inspector)", "inspector"), mk("inspector2", "Isha Patil (Inspector)", "inspector")
    sup1, sup2 = mk("supervisor", "Vikram Joshi (Supervisor)", "supervisor"), mk("supervisor2", "Neha Bhosale (Supervisor)", "supervisor")

    prod = services.create_product(conn, mgr, {"code": "PT-6060-GL", "name": "Glazed porcelain floor tile 600x600", "category": "tile", "supplier": "Demo Ceramics Pvt Ltd (fictional)", "production_line": "Line 2"})
    old = services.create_product(conn, mgr, {"code": "PT-3030-MT", "name": "Matt wall tile 300x300 (discontinued)", "category": "tile"})
    today = date.today()
    batches = {}
    for code, days_ago, qty in (("B-101", 40, 800), ("B-102", 26, 650), ("B-103", 12, 900), ("B-104", 4, 700)):
        batches[code] = services.create_batch(conn, mgr, {"product_id": prod["id"], "batch_code": code, "produced_date": (today - timedelta(days=days_ago)).isoformat(), "quantity": qty, "production_line": "Line 2"})
    old_b = services.create_batch(conn, mgr, {"product_id": old["id"], "batch_code": "B-090", "produced_date": (today - timedelta(days=90)).isoformat(), "quantity": 300})
    services.archive_product(conn, mgr, old["id"], {"reason": "Product discontinued (demo)"})   # history must survive this

    note = f"Source: {source}. Fictional demo record."

    def make_inspection(user, bcode, days_ago, items, notes=""):
        i = services.create_inspection(conn, user, {"batch_id": batches[bcode]["id"], "inspected_at": (today - timedelta(days=days_ago)).isoformat() + "T09:30:00Z", "notes": f"{notes} {note}".strip()})
        imgs = []
        for ref, kind, (data, tag) in items:
            imgs.append((services.upload_image(conn, user, i["id"], data, f"{tag}_{ref}.png", ref, kind), tag))
        services.submit_inspection(conn, user, i["id"])
        return i, imgs

    G = lambda: pool["good"].pop()
    def D(*kinds):
        """Take a defect image; ask for specific MVTec defect folders so the human-confirmed category matches the picture."""
        for i, (_, tag) in enumerate(pool["defect"]):
            if not kinds or tag in kinds:
                return pool["defect"].pop(i)
        return pool["defect"].pop()
    review = lambda u, img, **kw: services.submit_review(conn, u, img["id"], kw)
    crack = dict(decision="defect_confirmed", defect_category="crack", severity="major", description="Visible crack across the glaze", reason="Confirmed by eye at 100% zoom (demo)")
    stain = dict(decision="defect_confirmed", defect_category="oil_stain", severity="minor", description="Oil-like stain on surface", reason="Confirmed by eye at 100% zoom (demo)")

    # B-101 (oldest): clean batch, fully reviewed, released
    _, imgs = make_inspection(ins1, "B-101", 38, [(f"T{n}", "item", G()) for n in range(1, 5)], "Incoming sample check.")
    for img, _t in imgs:
        review(ins1, img, decision="no_defect", reason="No visible flaw at 100% zoom")
    services.record_batch_decision(conn, mgr, batches["B-101"]["id"], {"decision": "release", "reason": "4/4 sampled items clear; no open issues (demo)"})

    # B-102: crack found -> action -> follow-up clear -> closed (full cycle)
    _, imgs = make_inspection(ins1, "B-102", 24, [("T1", "item", G()), ("T2", "item", D("crack")), ("T3", "item", G()), ("T3", "item", G())], "Line 2 sample.")
    for img, tag in imgs:
        if tag == "good":
            review(ins1, img, decision="no_defect", reason="Clean (demo)")
        else:
            out = review(ins1, img, **crack)
            did = out["defect"]["id"]
    act = services.create_action(conn, mgr, did, {"owner_id": sup1["id"], "title": "Check kiln temperature profile and re-run sample", "target_date": (today + timedelta(days=1)).isoformat(), "notes": "Demo action"})
    services.update_action(conn, sup1, act["id"], {"status": "in_progress"})
    services.update_action(conn, sup1, act["id"], {"status": "done", "notes": "Profile adjusted"})
    fu = services.create_inspection(conn, sup1, {"batch_id": batches["B-102"]["id"], "follow_up_of_defect_id": did, "notes": f"Re-sample after kiln adjustment. {note}"})
    fimg = services.upload_image(conn, sup1, fu["id"], G()[0], "followup.png", "T2-RE", "item")
    services.submit_inspection(conn, sup1, fu["id"])
    review(ins1, fimg, decision="no_defect", reason="Re-sample is clear")
    services.close_defect(conn, ins1, did, {"reason": "Follow-up inspection clear"})
    services.record_batch_decision(conn, mgr, batches["B-102"]["id"], {"decision": "release", "reason": "Defect closed after follow-up (demo)"})

    # B-103: recurrence of cracks, overdue action, disputed image
    _, imgs = make_inspection(ins2, "B-103", 10, [("T1", "item", D("crack")), ("T2", "item", G()), ("T3", "item", D("crack")), ("T4", "item", G()), ("S1", "surface", G())], "Second batch from Line 2.")
    first = True
    for (img, tag), ref in zip(imgs, ("T1", "T2", "T3", "T4", "S1")):
        if ref == "T1":
            did3 = review(ins2, img, **crack)["defect"]["id"]
        elif ref == "T3":
            review(ins2, img, **crack)                                   # reviewer 1 says defect
            services.submit_review(conn, ins1, img["id"], {"decision": "no_defect", "reason": "Looks like a grout-colour variation, not a crack"})   # reviewer 2 disagrees -> disputed
        else:
            review(ins2, img, decision="no_defect", reason="Clean (demo)")
    services.create_action(conn, mgr, did3, {"owner_id": sup2["id"], "title": "Inspect press die alignment", "target_date": (today + timedelta(days=0)).isoformat()})
    conn.execute("UPDATE corrective_actions SET target_date=? WHERE defect_id=?", ((today - timedelta(days=3)).isoformat(), did3))   # make it overdue for the demo
    conn.commit()
    services.record_batch_decision(conn, mgr, batches["B-103"]["id"], {"decision": "hold", "reason": "Recurring cracks and one disputed image (demo)"})

    # B-104 (newest): unreviewed queue, uncertain AI, one needs-more-evidence, one second image of same item
    _, imgs = make_inspection(ins1, "B-104", 2, [("T1", "item", G()), ("T2", "item", D("oil", "oil_stain")), ("T3", "item", G()), ("T4", "item", D()), ("T5", "item", G()), ("T5", "item", G()), ("B1", "batch_sample", G())], "Newest batch - review in progress.")
    review(ins1, imgs[0][0], decision="no_defect", reason="Clean (demo)")
    review(ins1, imgs[1][0], **stain)
    services.submit_review(conn, ins1, imgs[3][0]["id"], {"decision": "needs_more_evidence", "reason": "Glare on the photo; need a second angle"})
    # imgs[2], imgs[4], imgs[5], imgs[6] stay pending on purpose

    n = conn.execute("SELECT COUNT(*) FROM images").fetchone()[0]
    st = ml_engine.status()
    print(f"Seeded {n} images, {conn.execute('SELECT COUNT(*) FROM defects').fetchone()[0]} defects. Source: {source}")
    print("AI model:", "ready " + str(st.get("model_version")) if st["available"] else f"NOT available ({st['reason']}) - images were stored with a failed AI run; retry after training")
    print(f"Accounts (password {PASSWORD}): manager, inspector, inspector2, supervisor, supervisor2")


if __name__ == "__main__":
    main()