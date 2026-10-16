"""All business rules live here (framework-free, so they can be unit-tested without a web server).

Every function takes the DB connection and the acting user (a dict from the users table) and enforces
permissions, validation and status transitions on the server. Mutating functions are wrapped by @tx so a failed
rule leaves no half-written data."""
import functools
import hashlib
import io
import re
import time
import uuid
from datetime import date, datetime, timedelta, timezone

from PIL import Image

from ml.priority import review_priority
from ml.quality import blur_score

from . import config, ml_engine
from .db import audit, now
from .errors import AppError
from .security import can, hash_password, make_token, require, verify_password

DEFECT_CATEGORIES = ["crack", "glue_strip", "gray_stroke", "oil_stain", "rough_surface", "chip", "other"]
SEVERITIES = ["minor", "major", "critical"]
IMAGE_KINDS = ["item", "surface", "batch_sample"]
DECISIONS = ["no_defect", "defect_confirmed", "needs_more_evidence"]
ACTION_STATUSES = ["open", "in_progress", "done", "cancelled"]
ACTION_TRANSITIONS = {"open": {"in_progress", "done", "cancelled"}, "in_progress": {"done", "cancelled"},
                      "done": set(), "cancelled": set()}


# --------------------------------------------------------------------------------------------- helpers
def tx(fn):
    @functools.wraps(fn)
    def wrapper(conn, *a, **k):
        try:
            result = fn(conn, *a, **k)
            conn.commit()
            return result
        except BaseException:
            conn.rollback()
            raise
    return wrapper


def _d(row):
    return dict(row) if row is not None else None


def _need(conn, table, id_, label):
    row = conn.execute(f"SELECT * FROM {table} WHERE id=?", (id_,)).fetchone()  # table names are internal constants
    if row is None:
        raise AppError(404, "NOT_FOUND", f"{label} {id_} was not found.")
    return row


def _text(data, key, label, required=True, maxlen=500):
    v = data.get(key)
    v = v.strip() if isinstance(v, str) else v
    if v in (None, ""):
        if required:
            raise AppError(422, "MISSING_VALUE", f"{label} is required.")
        return None
    if not isinstance(v, str):
        raise AppError(422, "INVALID_VALUE", f"{label} must be text.")
    if len(v) > maxlen:
        raise AppError(422, "TOO_LONG", f"{label} must be at most {maxlen} characters.")
    return v


def _date(value, label):
    try:
        return date.fromisoformat(str(value)).isoformat()
    except Exception:
        raise AppError(422, "INVALID_DATE", f"{label} must be a date like 2026-10-31.")


def _reason(data, label="A reason", required=True):
    return _text(data, "reason", label, required, 500)


def _today():
    return datetime.now(timezone.utc).date().isoformat()


def _is_sup(user):
    return user["role"] == "supervisor"


def _sup_defect_ids(conn, user):
    return {r[0] for r in conn.execute("SELECT DISTINCT defect_id FROM corrective_actions WHERE owner_id=?",
                                       (user["id"],))}


def _out_of_scope():
    return AppError(403, "OUT_OF_SCOPE", "You can only see records linked to corrective actions assigned to you.")


def _can_see_image(conn, user, image_id):
    if not _is_sup(user):
        return True
    ids = _sup_defect_ids(conn, user)
    if conn.execute("SELECT 1 FROM defects WHERE image_id=? AND id IN (%s)" % (",".join(map(str, ids)) or "0"),
                    (image_id,)).fetchone():
        return True
    return bool(conn.execute("SELECT 1 FROM images i JOIN inspections n ON n.id=i.inspection_id "
                             "WHERE i.id=? AND n.inspector_id=?", (image_id, user["id"])).fetchone())


def _can_see_inspection(conn, user, insp):
    if not _is_sup(user) or insp["inspector_id"] == user["id"]:
        return True
    return any(_can_see_image(conn, user, r[0])
               for r in conn.execute("SELECT id FROM images WHERE inspection_id=?", (insp["id"],)))


def _can_see_batch(conn, user, batch_id):
    if not _is_sup(user):
        return True
    ids = ",".join(map(str, _sup_defect_ids(conn, user))) or "0"
    return bool(conn.execute(f"SELECT 1 FROM defects WHERE batch_id=? AND id IN ({ids})", (batch_id,)).fetchone()
                or conn.execute("SELECT 1 FROM inspections WHERE batch_id=? AND inspector_id=?",
                                (batch_id, user["id"])).fetchone())


# --------------------------------------------------------------------------------------------- users
def authenticate(conn, username, password):
    row = conn.execute("SELECT * FROM users WHERE username=? AND active=1", ((username or "").strip(),)).fetchone()
    if not row or not verify_password(password or "", row["password_hash"]):
        raise AppError(401, "BAD_LOGIN", "Wrong username or password.")
    return {"token": make_token(row["id"]), "user": public_user(row)}


def public_user(row):
    return {"id": row["id"], "username": row["username"], "full_name": row["full_name"], "role": row["role"]}


def get_user(conn, user_id):
    row = conn.execute("SELECT * FROM users WHERE id=? AND active=1", (user_id,)).fetchone()
    if not row:
        raise AppError(401, "UNKNOWN_USER", "This account is not active.")
    return dict(row)


def list_users(conn, user, role=None):
    require(user, "users.list")
    q, p = "SELECT * FROM users WHERE active=1", []
    if role:
        q, p = q + " AND role=?", [role]
    return [public_user(r) for r in conn.execute(q + " ORDER BY full_name", p)]


@tx
def create_user(conn, username, full_name, role, password):
    conn.execute("INSERT INTO users(username,full_name,role,password_hash) VALUES(?,?,?,?)",
                 (username, full_name, role, hash_password(password)))
    return conn.execute("SELECT * FROM users WHERE username=?", (username,)).fetchone()["id"]


# --------------------------------------------------------------------------------------------- products
def _product_view(conn, row):
    d = dict(row)
    d["batch_count"] = conn.execute("SELECT COUNT(*) FROM batches WHERE product_id=?", (row["id"],)).fetchone()[0]
    return d


def list_products(conn, user, include_archived=False, q=None):
    sql, p = "SELECT * FROM products WHERE 1=1", []
    if not include_archived:
        sql += " AND status='active'"
    if q:
        sql += " AND (code LIKE ? OR name LIKE ?)"
        p += [f"%{q}%"] * 2
    rows = conn.execute(sql + " ORDER BY code", p).fetchall()
    if _is_sup(user):
        rows = [r for r in rows if any(_can_see_batch(conn, user, b[0]) for b in
                                       conn.execute("SELECT id FROM batches WHERE product_id=?", (r["id"],)))]
    return [_product_view(conn, r) for r in rows]


def get_product(conn, user, pid):
    return _product_view(conn, _need(conn, "products", pid, "Product"))


@tx
def create_product(conn, user, data):
    require(user, "product.write")
    code, name = _text(data, "code", "Product code", maxlen=40), _text(data, "name", "Product name", maxlen=120)
    category = _text(data, "category", "Category", maxlen=60)
    if conn.execute("SELECT 1 FROM products WHERE code=?", (code,)).fetchone():
        raise AppError(409, "DUPLICATE", f"A product with code {code} already exists.")
    cur = conn.execute("INSERT INTO products(code,name,category,supplier,production_line,created_at,created_by) "
                       "VALUES(?,?,?,?,?,?,?)",
                       (code, name, category, _text(data, "supplier", "Supplier", False, 120),
                        _text(data, "production_line", "Production line", False, 120), now(), user["id"]))
    audit(conn, user["id"], "product", cur.lastrowid, "created", detail={"code": code})
    return get_product(conn, user, cur.lastrowid)


@tx
def update_product(conn, user, pid, data):
    require(user, "product.write")
    row = _need(conn, "products", pid, "Product")
    reason = _reason(data, "A reason for the change")
    fields = {}
    for key, label, mx in (("name", "Product name", 120), ("category", "Category", 60),
                           ("supplier", "Supplier", 120), ("production_line", "Production line", 120)):
        if key in data:
            fields[key] = _text(data, key, label, key in ("name", "category"), mx)
    if not fields:
        raise AppError(422, "NOTHING_TO_UPDATE", "No changes were sent.")
    before = {k: row[k] for k in fields}
    conn.execute(f"UPDATE products SET {','.join(k + '=?' for k in fields)} WHERE id=?", [*fields.values(), pid])
    audit(conn, user["id"], "product", pid, "updated", reason, {"before": before, "after": fields})
    return get_product(conn, user, pid)


@tx
def archive_product(conn, user, pid, data):
    require(user, "product.write")
    row = _need(conn, "products", pid, "Product")
    if row["status"] == "archived":
        raise AppError(409, "ALREADY_ARCHIVED", "This product is already archived.")
    conn.execute("UPDATE products SET status='archived' WHERE id=?", (pid,))
    audit(conn, user["id"], "product", pid, "archived", _reason(data, "A reason for archiving"))
    return get_product(conn, user, pid)


# --------------------------------------------------------------------------------------------- batches
def _decision_status(conn, batch_id):
    r = conn.execute("SELECT * FROM batch_decisions WHERE batch_id=? ORDER BY id DESC LIMIT 1", (batch_id,)).fetchone()
    return _d(r)


def _batch_view(conn, row, with_coverage=False):
    d = dict(row)
    p = conn.execute("SELECT code,name,status FROM products WHERE id=?", (row["product_id"],)).fetchone()
    d.update(product_code=p["code"], product_name=p["name"], product_status=p["status"])
    d["latest_decision"] = _decision_status(conn, row["id"])
    if with_coverage:
        d["coverage"] = batch_coverage(conn, row["id"])
    return d


def list_batches(conn, user, product_id=None, include_archived=False, q=None, with_coverage=True):
    sql, p = "SELECT * FROM batches WHERE 1=1", []
    if product_id:
        sql, p = sql + " AND product_id=?", p + [product_id]
    if not include_archived:
        sql += " AND status='active'"
    if q:
        sql, p = sql + " AND batch_code LIKE ?", p + [f"%{q}%"]
    rows = [r for r in conn.execute(sql + " ORDER BY produced_date DESC, id DESC", p)
            if _can_see_batch(conn, user, r["id"])]
    return [_batch_view(conn, r, with_coverage) for r in rows]


def get_batch(conn, user, bid):
    row = _need(conn, "batches", bid, "Batch")
    if not _can_see_batch(conn, user, bid):
        raise _out_of_scope()
    d = _batch_view(conn, row, True)
    d["decisions"] = [dict(r) for r in conn.execute(
        "SELECT d.*, u.full_name AS decided_by_name FROM batch_decisions d JOIN users u ON u.id=d.decided_by "
        "WHERE batch_id=? ORDER BY d.id DESC", (bid,))]
    return d


@tx
def create_batch(conn, user, data):
    require(user, "batch.write")
    prod = _need(conn, "products", data.get("product_id"), "Product")
    if prod["status"] != "active":
        raise AppError(409, "PRODUCT_ARCHIVED", "This product is archived; new batches can't be added to it.")
    code = _text(data, "batch_code", "Batch code", maxlen=40)
    produced = _date(data.get("produced_date"), "Production date")
    try:
        qty = int(data.get("quantity"))
        assert qty > 0
    except Exception:
        raise AppError(422, "INVALID_QUANTITY", "Quantity must be a whole number above zero.")
    if conn.execute("SELECT 1 FROM batches WHERE batch_code=?", (code,)).fetchone():
        raise AppError(409, "DUPLICATE", f"Batch {code} already exists.")
    cur = conn.execute("INSERT INTO batches(product_id,batch_code,produced_date,quantity,production_line,supplier,"
                       "created_at,created_by) VALUES(?,?,?,?,?,?,?,?)",
                       (prod["id"], code, produced, qty, _text(data, "production_line", "Line", False, 120),
                        _text(data, "supplier", "Supplier", False, 120), now(), user["id"]))
    audit(conn, user["id"], "batch", cur.lastrowid, "created", detail={"batch_code": code})
    return get_batch(conn, user, cur.lastrowid)


@tx
def update_batch(conn, user, bid, data):
    require(user, "batch.write")
    row = _need(conn, "batches", bid, "Batch")
    if row["status"] == "archived":
        raise AppError(409, "BATCH_ARCHIVED", "Archived batches can't be edited.")
    reason = _reason(data, "A reason for the change")
    fields = {}
    if "produced_date" in data:
        fields["produced_date"] = _date(data["produced_date"], "Production date")
    if "quantity" in data:
        try:
            fields["quantity"] = int(data["quantity"])
            assert fields["quantity"] > 0
        except Exception:
            raise AppError(422, "INVALID_QUANTITY", "Quantity must be a whole number above zero.")
    for key in ("production_line", "supplier"):
        if key in data:
            fields[key] = _text(data, key, key, False, 120)
    if not fields:
        raise AppError(422, "NOTHING_TO_UPDATE", "No changes were sent.")
    conn.execute(f"UPDATE batches SET {','.join(k + '=?' for k in fields)} WHERE id=?", [*fields.values(), bid])
    audit(conn, user["id"], "batch", bid, "updated", reason, {"before": {k: row[k] for k in fields}, "after": fields})
    return get_batch(conn, user, bid)


@tx
def archive_batch(conn, user, bid, data):
    require(user, "batch.archive")
    row = _need(conn, "batches", bid, "Batch")
    if row["status"] == "archived":
        raise AppError(409, "ALREADY_ARCHIVED", "This batch is already archived.")
    conn.execute("UPDATE batches SET status='archived' WHERE id=?", (bid,))
    audit(conn, user["id"], "batch", bid, "archived", _reason(data, "A reason for archiving"))
    return get_batch(conn, user, bid)


# --------------------------------------------------------------------------------------------- review state
def review_state(conn, image_id):
    """Current human-confirmed state of an image, derived from the append-only review history.
    pending | needs_more_evidence | no_defect | defect_confirmed | disputed (reviewers disagree) ; resolved flag."""
    rows = conn.execute("SELECT * FROM reviews WHERE image_id=? ORDER BY id", (image_id,)).fetchall()
    resolutions = [r for r in rows if r["kind"] == "resolution"]
    if resolutions:
        return resolutions[-1]["decision"], True
    if not rows:
        return "pending", False
    latest = {}
    for r in rows:
        latest[r["reviewer_id"]] = r
    decisive = {r["decision"] for r in latest.values() if r["decision"] in ("no_defect", "defect_confirmed")}
    if len(decisive) > 1:
        return "disputed", False
    return rows[-1]["decision"], False


def _run_view(r):
    if r is None:
        return None
    d = dict(r)
    d["heatmap_available"] = bool(r["heatmap_name"])
    d.pop("heatmap_name", None)
    return d


def _latest_run(conn, image_id):
    return conn.execute("SELECT * FROM model_runs WHERE image_id=? ORDER BY id DESC LIMIT 1", (image_id,)).fetchone()


def _image_view(conn, row, detail=False):
    d = dict(row)
    d.pop("stored_name", None)
    run = _latest_run(conn, row["id"])
    d["latest_run"] = _run_view(run)
    d["review_state"], d["resolved"] = review_state(conn, row["id"])
    failed = run is not None and run["status"] == "failed"
    ok = run is not None and run["status"] == "ok"
    d["priority"], d["priority_reason"] = review_priority(
        run["score"] if ok else None, run["threshold"] if ok else None, bool(row["low_quality"]), failed, run is None)
    d["ai_note"] = ("The machine result is a suggestion; the confirmed result is set by a human reviewer."
                    if ok else None)
    defect = conn.execute("SELECT id,status,category,severity FROM defects WHERE image_id=? AND status!='withdrawn'",
                          (row["id"],)).fetchone()
    d["defect"] = _d(defect)
    if detail:
        d["runs"] = [_run_view(r) for r in conn.execute(
            "SELECT * FROM model_runs WHERE image_id=? ORDER BY id DESC", (row["id"],))]
        d["reviews"] = [dict(r) for r in conn.execute(
            "SELECT v.*, u.full_name AS reviewer_name FROM reviews v JOIN users u ON u.id=v.reviewer_id "
            "WHERE image_id=? ORDER BY v.id DESC", (row["id"],))]
        ctx = conn.execute("SELECT n.id AS inspection_id, n.status AS inspection_status, n.notes AS inspection_notes, "
                           "n.inspected_at, n.follow_up_of_defect_id, b.id AS batch_id, b.batch_code, "
                           "p.code AS product_code, p.name AS product_name FROM inspections n "
                           "JOIN batches b ON b.id=n.batch_id JOIN products p ON p.id=b.product_id WHERE n.id=?",
                           (row["inspection_id"],)).fetchone()
        d.update(dict(ctx))
    return d


# --------------------------------------------------------------------------------------------- inspections
def _insp_view(conn, row, detail=False):
    d = dict(row)
    b = conn.execute("SELECT b.batch_code, b.product_id, p.code AS product_code, p.name AS product_name "
                     "FROM batches b JOIN products p ON p.id=b.product_id WHERE b.id=?", (row["batch_id"],)).fetchone()
    d.update(dict(b))
    d["inspector_name"] = conn.execute("SELECT full_name FROM users WHERE id=?", (row["inspector_id"],)).fetchone()[0]
    imgs = conn.execute("SELECT * FROM images WHERE inspection_id=? AND status='active' ORDER BY id", (row["id"],)).fetchall()
    d["image_count"] = len(imgs)
    d["item_count"] = len({i["sample_ref"] for i in imgs if i["image_kind"] == "item"})
    if detail:
        d["images"] = [_image_view(conn, i) for i in imgs]
        d["revisions"] = [dict(r) for r in conn.execute(
            "SELECT r.*, u.full_name AS edited_by_name FROM inspection_revisions r JOIN users u ON u.id=r.edited_by "
            "WHERE inspection_id=? ORDER BY version DESC", (row["id"],))]
    return d


def list_inspections(conn, user, batch_id=None, status=None, date_from=None, date_to=None, inspector_id=None,
                     product_id=None, q=None):
    sql = ("SELECT n.* FROM inspections n JOIN batches b ON b.id=n.batch_id WHERE 1=1")
    p = []
    for cond, val in (("n.batch_id=?", batch_id), ("n.status=?", status), ("n.inspector_id=?", inspector_id),
                      ("b.product_id=?", product_id), ("substr(n.inspected_at,1,10)>=?", date_from),
                      ("substr(n.inspected_at,1,10)<=?", date_to)):
        if val not in (None, ""):
            sql, p = sql + " AND " + cond, p + [val]
    if q:
        sql, p = sql + " AND (n.notes LIKE ? OR b.batch_code LIKE ?)", p + [f"%{q}%"] * 2
    rows = [r for r in conn.execute(sql + " ORDER BY n.inspected_at DESC, n.id DESC", p)
            if _can_see_inspection(conn, user, r)]
    return [_insp_view(conn, r) for r in rows]


def get_inspection(conn, user, iid):
    row = _need(conn, "inspections", iid, "Inspection")
    if not _can_see_inspection(conn, user, row):
        raise _out_of_scope()
    return _insp_view(conn, row, True)


@tx
def create_inspection(conn, user, data, idem_key=None):
    """Repeat submissions with the same Idempotency-Key return the first record instead of a duplicate."""
    batch = _need(conn, "batches", data.get("batch_id"), "Batch")
    follow_id = data.get("follow_up_of_defect_id")
    if follow_id:
        defect = _need(conn, "defects", follow_id, "Defect")
        if defect["batch_id"] != batch["id"]:
            raise AppError(422, "WRONG_BATCH", "A follow-up inspection must use the same batch as the defect.")
        if defect["status"] in ("withdrawn",):
            raise AppError(409, "DEFECT_WITHDRAWN", "This defect was withdrawn; no follow-up is needed.")
        if _is_sup(user) and follow_id not in _sup_defect_ids(conn, user):
            raise AppError(403, "NOT_ASSIGNED", "You can only submit follow-up evidence for defects assigned to you.")
        if not _is_sup(user):
            require(user, "inspection.create")
    else:
        require(user, "inspection.create")
    if idem_key:
        prev = conn.execute("SELECT * FROM inspections WHERE inspector_id=? AND idem_key=?",
                            (user["id"], idem_key)).fetchone()
        if prev:
            return {**_insp_view(conn, prev, True), "replayed": True}
    if batch["status"] != "active":
        raise AppError(409, "BATCH_ARCHIVED", "This batch is archived; new inspections can't be added.")
    when = data.get("inspected_at") or now()
    if not re.match(r"^\d{4}-\d{2}-\d{2}", str(when)):
        raise AppError(422, "INVALID_DATE", "Inspection time must start with a date like 2026-10-13.")
    notes = (data.get("notes") or "").strip()[:2000]
    cur = conn.execute("INSERT INTO inspections(batch_id,inspector_id,inspected_at,notes,follow_up_of_defect_id,"
                       "idem_key,created_at) VALUES(?,?,?,?,?,?,?)",
                       (batch["id"], user["id"], str(when), notes, follow_id, idem_key, now()))
    conn.execute("INSERT INTO inspection_revisions(inspection_id,version,notes,edited_by,edited_at,reason) "
                 "VALUES(?,?,?,?,?,?)", (cur.lastrowid, 1, notes, user["id"], now(), "original"))
    audit(conn, user["id"], "inspection", cur.lastrowid, "created",
          detail={"batch_id": batch["id"], "follow_up_of_defect_id": follow_id})
    return {**_insp_view(conn, _need(conn, "inspections", cur.lastrowid, "Inspection"), True), "replayed": False}


def _owns_or_manager(user, insp):
    if user["role"] == "manager" or insp["inspector_id"] == user["id"]:
        return
    raise AppError(403, "NOT_YOURS", "Only the inspector who created this inspection, or a manager, can change it.")


@tx
def update_inspection_notes(conn, user, iid, data):
    """Drafts are edited in place. Submitted inspections keep the original: every edit adds a numbered revision."""
    insp = _need(conn, "inspections", iid, "Inspection")
    _owns_or_manager(user, insp)
    if insp["status"] == "archived":
        raise AppError(409, "ARCHIVED", "Archived inspections can't be edited.")
    notes = _text(data, "notes", "Observations", True, 2000)
    reason = _reason(data, "A reason for the correction", required=insp["status"] == "submitted")
    version = conn.execute("SELECT MAX(version) FROM inspection_revisions WHERE inspection_id=?", (iid,)).fetchone()[0] + 1
    conn.execute("INSERT INTO inspection_revisions(inspection_id,version,notes,edited_by,edited_at,reason) "
                 "VALUES(?,?,?,?,?,?)", (iid, version, notes, user["id"], now(), reason or "draft edit"))
    conn.execute("UPDATE inspections SET notes=? WHERE id=?", (notes, iid))
    audit(conn, user["id"], "inspection", iid, "notes_revised", reason, {"version": version})
    return get_inspection(conn, user, iid)


@tx
def submit_inspection(conn, user, iid):
    insp = _need(conn, "inspections", iid, "Inspection")
    _owns_or_manager(user, insp)
    if insp["status"] != "draft":
        raise AppError(409, "BAD_TRANSITION", f"Only a draft can be submitted (this one is {insp['status']}).")
    n = conn.execute("SELECT COUNT(*) FROM images WHERE inspection_id=? AND status='active'", (iid,)).fetchone()[0]
    if n == 0:
        raise AppError(422, "NO_IMAGES", "Upload at least one image before submitting the inspection.")
    conn.execute("UPDATE inspections SET status='submitted' WHERE id=?", (iid,))
    audit(conn, user["id"], "inspection", iid, "submitted", detail={"images": n})
    return get_inspection(conn, user, iid)


@tx
def archive_inspection(conn, user, iid, data):
    insp = _need(conn, "inspections", iid, "Inspection")
    _owns_or_manager(user, insp)
    if insp["status"] == "archived":
        raise AppError(409, "ALREADY_ARCHIVED", "This inspection is already archived.")
    conn.execute("UPDATE inspections SET status='archived' WHERE id=?", (iid,))
    audit(conn, user["id"], "inspection", iid, "archived", _reason(data, "A reason for archiving"))
    return get_inspection(conn, user, iid)


@tx
def delete_draft(conn, user, iid):
    """Only an EMPTY draft may be deleted. Anything with evidence is archived so history is never lost."""
    insp = _need(conn, "inspections", iid, "Inspection")
    _owns_or_manager(user, insp)
    if insp["status"] != "draft":
        raise AppError(409, "NOT_A_DRAFT", "Submitted inspections can't be deleted; archive them instead.")
    if conn.execute("SELECT COUNT(*) FROM images WHERE inspection_id=?", (iid,)).fetchone()[0]:
        raise AppError(409, "HAS_EVIDENCE", "This draft already has uploaded evidence; archive it instead of deleting.")
    conn.execute("DELETE FROM inspection_revisions WHERE inspection_id=?", (iid,))
    conn.execute("DELETE FROM inspections WHERE id=?", (iid,))
    audit(conn, user["id"], "inspection", iid, "draft_deleted")
    return {"deleted": iid}


# --------------------------------------------------------------------------------------------- images & ML
def _process_image(conn, image, user_id):
    """Run the model and store the outcome. A failure is stored too (attempt kept) - never hidden or invented."""
    attempt = conn.execute("SELECT COALESCE(MAX(attempt_no),0) FROM model_runs WHERE image_id=?",
                           (image["id"],)).fetchone()[0] + 1
    heat = f"{uuid.uuid4().hex}_heat.png"
    t0 = time.perf_counter()
    try:
        res = ml_engine.predict(config.UPLOAD_DIR / image["stored_name"], config.UPLOAD_DIR / heat)
        conn.execute("INSERT INTO model_runs(image_id,attempt_no,model_name,model_version,status,predicted_label,"
                     "score,threshold,processing_ms,heatmap_name,triggered_by,created_at) "
                     "VALUES(?,?,?,?,?,?,?,?,?,?,?,?)",
                     (image["id"], attempt, res["model_name"], res["model_version"], "ok", res["label"], res["score"],
                      res["threshold"], res["processing_ms"], heat, user_id, now()))
    except Exception as exc:
        conn.execute("INSERT INTO model_runs(image_id,attempt_no,status,processing_ms,error,triggered_by,created_at) "
                     "VALUES(?,?,?,?,?,?,?)",
                     (image["id"], attempt, "failed", int((time.perf_counter() - t0) * 1000),
                      f"{exc.__class__.__name__}: {exc}"[:300], user_id, now()))
    return attempt


def _check_upload_rights(conn, user, insp):
    if _is_sup(user):
        if insp["inspector_id"] != user["id"] or not insp["follow_up_of_defect_id"]:
            raise AppError(403, "NOT_ASSIGNED", "Supervisors can only upload evidence to their own follow-up inspections.")
    else:
        require(user, "inspection.create")
    if insp["status"] == "archived":
        raise AppError(409, "ARCHIVED", "This inspection is archived; upload to an active one.")


@tx
def upload_image(conn, user, iid, data: bytes, filename, sample_ref, image_kind):
    insp = _need(conn, "inspections", iid, "Inspection")
    _check_upload_rights(conn, user, insp)
    sample_ref = (sample_ref or "").strip()
    if not sample_ref or len(sample_ref) > 60:
        raise AppError(422, "MISSING_VALUE", "Item / sample reference is required (max 60 characters).")
    if image_kind not in IMAGE_KINDS:
        raise AppError(422, "INVALID_KIND", "Say whether this image is an item, a surface or a batch sample.")
    if not data:
        raise AppError(400, "EMPTY_FILE", "The uploaded file is empty.")
    if len(data) > config.MAX_UPLOAD_BYTES:
        raise AppError(413, "FILE_TOO_LARGE", f"Images can be at most {config.MAX_UPLOAD_BYTES // (1024 * 1024)} MB.")
    try:
        probe = Image.open(io.BytesIO(data))
        fmt, (w, h) = probe.format, probe.size
        if w * h > config.MAX_PIXELS:
            raise AppError(413, "IMAGE_TOO_LARGE", "This image has too many pixels; resize it and retry.")
        probe.verify()
        img = Image.open(io.BytesIO(data))
        img.load()
    except AppError:
        raise
    except Exception:
        raise AppError(415, "CORRUPT_OR_UNSUPPORTED", "This file is corrupt or not an image. Upload a JPEG, PNG or BMP.")
    if fmt not in config.ALLOWED_FORMATS:
        raise AppError(415, "UNSUPPORTED_FORMAT", f"{fmt} images aren't supported. Upload a JPEG, PNG or BMP.")
    digest = hashlib.sha256(data).hexdigest()
    dup = conn.execute("SELECT id FROM images WHERE inspection_id=? AND sha256=?", (iid, digest)).fetchone()
    if dup:
        raise AppError(409, "DUPLICATE_IMAGE", f"This exact file is already part of the inspection (image {dup['id']}).")
    mime, ext = config.ALLOWED_FORMATS[fmt]
    stored = f"{uuid.uuid4().hex}{ext}"
    config.UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
    (config.UPLOAD_DIR / stored).write_bytes(data)              # the original is kept untouched
    blur = blur_score(img)
    cur = conn.execute(
        "INSERT INTO images(inspection_id,sample_ref,image_kind,original_name,stored_name,sha256,mime,width,height,"
        "size_bytes,blur_score,low_quality,uploaded_by,uploaded_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
        (iid, sample_ref, image_kind, (filename or "upload")[:200], stored, digest, mime, w, h, len(data), blur,
         int(blur < config.blur_threshold()), user["id"], now()))
    audit(conn, user["id"], "image", cur.lastrowid, "uploaded", detail={"inspection_id": iid, "kind": image_kind})
    conn.commit()                                                # keep the evidence even if processing fails
    image = _need(conn, "images", cur.lastrowid, "Image")
    _process_image(conn, image, user["id"])
    return _image_view(conn, image)


@tx
def retry_processing(conn, user, image_id):
    require(user, "review.write")
    image = _need(conn, "images", image_id, "Image")
    attempt = _process_image(conn, image, user["id"])
    audit(conn, user["id"], "image", image_id, "reprocessed", detail={"attempt": attempt})
    return _image_view(conn, image, True)


def get_image(conn, user, image_id):
    image = _need(conn, "images", image_id, "Image")
    if not _can_see_image(conn, user, image_id):
        raise _out_of_scope()
    return _image_view(conn, image, True)


def image_file_path(conn, user, image_id, heatmap_run_id=None):
    """Returns (path, mime) after the same permission check as the record - files are never public."""
    image = _need(conn, "images", image_id, "Image")
    if not _can_see_image(conn, user, image_id):
        raise _out_of_scope()
    if heatmap_run_id:
        run = conn.execute("SELECT * FROM model_runs WHERE id=? AND image_id=?", (heatmap_run_id, image_id)).fetchone()
        if not run or not run["heatmap_name"]:
            raise AppError(404, "NO_HEATMAP", "No heat map is stored for this model run.")
        return config.UPLOAD_DIR / run["heatmap_name"], "image/png"
    return config.UPLOAD_DIR / image["stored_name"], image["mime"]


# --------------------------------------------------------------------------------------------- reviews
def _ai_agrees(run, decision):
    if run is None or run["status"] != "ok" or run["predicted_label"] == "uncertain":
        return None
    if decision == "needs_more_evidence":
        return None
    return int((run["predicted_label"] == "defective") == (decision == "defect_confirmed"))


def _recurrence_of(conn, batch_id, category):
    row = conn.execute(
        "SELECT d.id FROM defects d JOIN batches b ON b.id=d.batch_id WHERE d.category=? AND d.status!='withdrawn' "
        "AND b.product_id=(SELECT product_id FROM batches WHERE id=?) ORDER BY d.id DESC LIMIT 1",
        (category, batch_id)).fetchone()
    return row[0] if row else None


def _ensure_defect(conn, user, image, data):
    existing = conn.execute("SELECT * FROM defects WHERE image_id=? AND status!='withdrawn'", (image["id"],)).fetchone()
    if existing:
        return existing["id"]
    batch_id = conn.execute("SELECT batch_id FROM inspections WHERE id=?", (image["inspection_id"],)).fetchone()[0]
    cur = conn.execute("INSERT INTO defects(image_id,batch_id,category,severity,description,recurrence_of,created_by,"
                       "created_at) VALUES(?,?,?,?,?,?,?,?)",
                       (image["id"], batch_id, data["category"], data["severity"], data["description"],
                        _recurrence_of(conn, batch_id, data["category"]), user["id"], now()))
    audit(conn, user["id"], "defect", cur.lastrowid, "created", detail={"image_id": image["id"]})
    return cur.lastrowid


def _validate_decision(data, run):
    decision = data.get("decision")
    if decision not in DECISIONS:
        raise AppError(422, "INVALID_DECISION", f"Decision must be one of: {', '.join(DECISIONS)}.")
    out = {"decision": decision, "reason": _text(data, "reason", "Reason", False, 500), "category": None,
           "severity": None, "description": _text(data, "description", "Description", False, 1000)}
    agrees = _ai_agrees(run, decision)
    if (agrees == 0 or decision == "needs_more_evidence" or run is None or run["status"] != "ok") and not out["reason"]:
        raise AppError(422, "REASON_REQUIRED", "Explain this decision: it differs from the AI suggestion, asks for "
                                               "more evidence, or there is no AI result to rely on.")
    if decision == "defect_confirmed":
        out["category"], out["severity"] = data.get("defect_category"), data.get("severity")
        if out["category"] not in DEFECT_CATEGORIES:
            raise AppError(422, "INVALID_CATEGORY", f"Defect category must be one of: {', '.join(DEFECT_CATEGORIES)}.")
        if out["severity"] not in SEVERITIES:
            raise AppError(422, "INVALID_SEVERITY", f"Severity must be one of: {', '.join(SEVERITIES)}.")
        if not out["description"]:
            raise AppError(422, "MISSING_VALUE", "Describe the defect (what and where).")
    return out, agrees


def _record_review(conn, user, image_id, data, kind):
    image = _need(conn, "images", image_id, "Image")
    insp = _need(conn, "inspections", image["inspection_id"], "Inspection")
    if insp["status"] != "submitted":
        raise AppError(409, "NOT_SUBMITTED", "Submit the inspection before reviewing its images.")
    if image["status"] != "active":
        raise AppError(409, "IMAGE_ARCHIVED", "This image is archived.")
    run = _latest_run(conn, image_id)
    if data.get("model_run_id") and (run is None or int(data["model_run_id"]) != run["id"]):
        raise AppError(409, "STALE_RUN", "A newer AI result exists for this image. Reload and review it.")
    v, agrees = _validate_decision(data, run)
    cur = conn.execute("INSERT INTO reviews(image_id,model_run_id,reviewer_id,kind,decision,defect_category,severity,"
                       "description,reason,agrees_with_ai,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)",
                       (image_id, run["id"] if run else None, user["id"], kind, v["decision"], v["category"],
                        v["severity"], v["description"], v["reason"], agrees, now()))
    audit(conn, user["id"], "image", image_id, "reviewed" if kind == "review" else "dispute_resolved", v["reason"],
          {"decision": v["decision"], "review_id": cur.lastrowid, "agrees_with_ai": agrees})
    if v["decision"] == "defect_confirmed":
        _ensure_defect(conn, user, image, v)
    return image


@tx
def submit_review(conn, user, image_id, data):
    require(user, "review.write")
    _, resolved = review_state(conn, image_id)
    if resolved:
        raise AppError(409, "ALREADY_RESOLVED", "A manager already resolved this image; it can't be reviewed again.")
    _record_review(conn, user, image_id, data, "review")
    return get_image(conn, user, image_id)


@tx
def resolve_dispute(conn, user, image_id, data):
    require(user, "review.resolve")
    state, resolved = review_state(conn, image_id)
    if resolved or state != "disputed":
        raise AppError(409, "NOT_DISPUTED", "Only images whose reviewers disagree can be resolved.")
    if data.get("decision") == "needs_more_evidence":
        raise AppError(422, "INVALID_DECISION", "A resolution must be 'no_defect' or 'defect_confirmed'.")
    if not _text(data, "reason", "Reason", False, 500):
        raise AppError(422, "REASON_REQUIRED", "A resolution needs a recorded reason.")
    image = _record_review(conn, user, image_id, data, "resolution")
    if data["decision"] == "no_defect":
        for d in conn.execute("SELECT id,status FROM defects WHERE image_id=? AND status!='withdrawn'", (image_id,)).fetchall():
            conn.execute("UPDATE defects SET status='withdrawn' WHERE id=?", (d["id"],))
            audit(conn, user["id"], "defect", d["id"], "withdrawn", data.get("reason"), {"from": d["status"]})
    return get_image(conn, user, image_id)


# --------------------------------------------------------------------------------------------- items & coverage
def _item_state(states):
    if "defect_confirmed" in states:
        return "defect_confirmed"
    if all(s == "no_defect" for s in states):
        return "clear"
    if "disputed" in states:
        return "disputed"
    return "unreviewed"


def item_stats(pairs):
    """pairs: (item_key, image_review_state). Counts ITEMS, not photographs: several photos of one item are one item."""
    items = {}
    for key, state in pairs:
        items.setdefault(key, []).append(state)
    states = [_item_state(v) for v in items.values()]
    reviewed = states.count("clear") + states.count("defect_confirmed")
    return {"inspected": len(items), "reviewed": reviewed, "with_confirmed_defect": states.count("defect_confirmed"),
            "disputed": states.count("disputed"), "unreviewed": states.count("unreviewed"),
            "defect_rate": round(states.count("defect_confirmed") / reviewed, 4) if reviewed else None}


RATE_DEFINITION = ("Defect rate = items with a human-confirmed defect / items fully reviewed. Items are counted by "
                   "sample reference (several photos of one item count once). Only 'item' images from original "
                   "(non follow-up) inspections are included; AI flags are never counted as defects.")


def batch_coverage(conn, batch_id):
    rows = conn.execute("SELECT i.* FROM images i JOIN inspections n ON n.id=i.inspection_id WHERE n.batch_id=? "
                        "AND n.status='submitted' AND n.follow_up_of_defect_id IS NULL AND i.status='active'",
                        (batch_id,)).fetchall()
    states = {r["id"]: review_state(conn, r["id"])[0] for r in rows}
    stats = item_stats([(r["sample_ref"], states[r["id"]]) for r in rows if r["image_kind"] == "item"])
    qty = conn.execute("SELECT quantity FROM batches WHERE id=?", (batch_id,)).fetchone()[0]
    stats.update(
        batch_quantity=qty, inspected_share_of_batch=round(stats["inspected"] / qty, 4),
        other_evidence={"surface_images": sum(r["image_kind"] == "surface" for r in rows),
                        "batch_sample_images": sum(r["image_kind"] == "batch_sample" for r in rows),
                        "unreviewed": sum(r["image_kind"] != "item" and states[r["id"]] in ("pending", "needs_more_evidence")
                                          for r in rows)},
        images_total=len(rows), rate_definition=RATE_DEFINITION,
        open_defects=conn.execute("SELECT COUNT(*) FROM defects WHERE batch_id=? AND status IN "
                                  "('open','awaiting_reinspection','reopened')", (batch_id,)).fetchone()[0])
    return stats


@tx
def record_batch_decision(conn, user, bid, data):
    """Hold/release is a separate, human-recorded decision. One reviewed image never decides a whole batch."""
    require(user, "batch.decide", "Only a quality manager can record a batch hold or release.")
    batch = _need(conn, "batches", bid, "Batch")
    if batch["status"] != "active":
        raise AppError(409, "BATCH_ARCHIVED", "Archived batches can't receive a decision.")
    decision = data.get("decision")
    if decision not in ("hold", "release"):
        raise AppError(422, "INVALID_DECISION", "Decision must be 'hold' or 'release'.")
    reason = _text(data, "reason", "Reason", True, 500)
    last = _decision_status(conn, bid)
    if last and last["decision"] == decision:
        raise AppError(409, "NO_CHANGE", f"This batch is already on '{decision}'. Record a change only if the decision changes.")
    cov = batch_coverage(conn, bid)
    outstanding = cov["unreviewed"] + cov["disputed"]
    if decision == "release" and (outstanding or cov["open_defects"]) and not data.get("acknowledge"):
        raise AppError(409, "NEEDS_ACKNOWLEDGEMENT",
                       f"{outstanding} item(s) are unreviewed or disputed and {cov['open_defects']} defect(s) are not closed. "
                       "Confirm you are releasing with this evidence gap by acknowledging it.")
    conn.execute("INSERT INTO batch_decisions(batch_id,decision,reason,decided_by,decided_at,items_inspected,"
                 "items_reviewed,pending_items,open_defects) VALUES(?,?,?,?,?,?,?,?,?)",
                 (bid, decision, reason, user["id"], now(), cov["inspected"], cov["reviewed"], outstanding,
                  cov["open_defects"]))
    audit(conn, user["id"], "batch", bid, f"decision_{decision}", reason,
          {"acknowledged_gap": bool(data.get("acknowledge")), "pending_items": outstanding})
    return get_batch(conn, user, bid)


# --------------------------------------------------------------------------------------------- defects & actions
def _action_view(conn, r):
    d = dict(r)
    d["owner_name"] = conn.execute("SELECT full_name FROM users WHERE id=?", (r["owner_id"],)).fetchone()[0]
    d["overdue"] = r["status"] in ("open", "in_progress") and r["target_date"] < _today()
    return d


def _defect_view(conn, row, detail=False):
    d = dict(row)
    ctx = conn.execute("SELECT b.batch_code, b.product_id, p.code AS product_code, p.name AS product_name, "
                       "i.sample_ref, i.inspection_id FROM images i JOIN inspections n ON n.id=i.inspection_id "
                       "JOIN batches b ON b.id=n.batch_id JOIN products p ON p.id=b.product_id WHERE i.id=?",
                       (row["image_id"],)).fetchone()
    d.update(dict(ctx))
    d["review_state"] = review_state(conn, row["image_id"])[0]
    actions = [_action_view(conn, a) for a in conn.execute(
        "SELECT * FROM corrective_actions WHERE defect_id=? ORDER BY id", (row["id"],))]
    d["actions"] = actions
    d["open_actions"] = sum(a["status"] in ("open", "in_progress") for a in actions)
    d["overdue_actions"] = sum(a["overdue"] for a in actions)
    d["recurrence"] = None
    if row["recurrence_of"]:
        prev = conn.execute("SELECT d.id,d.status,d.category,b.batch_code FROM defects d JOIN batches b ON b.id=d.batch_id "
                            "WHERE d.id=?", (row["recurrence_of"],)).fetchone()
        d["recurrence"] = {**dict(prev), "note": "Same category seen earlier on this product. Similarity is not proof "
                                                   "of the same cause."}
    if detail:
        d["follow_ups"] = [dict(r) for r in conn.execute(
            "SELECT id,status,inspected_at,notes FROM inspections WHERE follow_up_of_defect_id=? ORDER BY id", (row["id"],))]
        d["history"] = list_audit(conn, {"role": "manager", "id": 0}, "defect", row["id"], 100)
        d["image"] = _image_view(conn, _need(conn, "images", row["image_id"], "Image"))
    return d


def list_defects(conn, user, f=None):
    f = f or {}
    sql = ("SELECT d.* FROM defects d JOIN batches b ON b.id=d.batch_id WHERE 1=1")
    p = []
    if not f.get("include_withdrawn"):
        sql += " AND d.status!='withdrawn'"
    for cond, val in (("d.status=?", f.get("status")), ("d.batch_id=?", f.get("batch_id")),
                      ("b.product_id=?", f.get("product_id")), ("d.category=?", f.get("defect_category") or f.get("category")),
                      ("substr(d.created_at,1,10)>=?", f.get("date_from")), ("substr(d.created_at,1,10)<=?", f.get("date_to")),
                      ("EXISTS(SELECT 1 FROM corrective_actions a WHERE a.defect_id=d.id AND a.owner_id=?)",
                       f.get("owner_id") or f.get("action_owner_id"))):
        if val not in (None, ""):
            sql, p = sql + " AND " + cond, p + [val]
    if f.get("recurring"):
        sql += " AND d.recurrence_of IS NOT NULL"
    rows = conn.execute(sql + " ORDER BY d.id DESC", p).fetchall()
    if _is_sup(user):
        mine = _sup_defect_ids(conn, user)
        rows = [r for r in rows if r["id"] in mine]
    views = [_defect_view(conn, r) for r in rows]
    if f.get("review_state"):
        views = [v for v in views if v["review_state"] == f["review_state"]]
    return views


def get_defect(conn, user, did):
    row = _need(conn, "defects", did, "Defect")
    if _is_sup(user) and did not in _sup_defect_ids(conn, user):
        raise _out_of_scope()
    return _defect_view(conn, row, True)


def list_actions(conn, user, f=None):
    f = f or {}
    sql = ("SELECT a.* FROM corrective_actions a JOIN defects d ON d.id=a.defect_id JOIN batches b ON b.id=d.batch_id "
           "WHERE d.status!='withdrawn'")
    p = []
    owner = user["id"] if _is_sup(user) else (f.get("owner_id") or f.get("action_owner_id"))
    for cond, val in (("a.owner_id=?", owner), ("a.status=?", f.get("status")), ("a.defect_id=?", f.get("defect_id")),
                      ("d.batch_id=?", f.get("batch_id")), ("b.product_id=?", f.get("product_id")),
                      ("d.category=?", f.get("defect_category")),
                      ("substr(a.created_at,1,10)>=?", f.get("date_from")), ("substr(a.created_at,1,10)<=?", f.get("date_to"))):
        if val not in (None, ""):
            sql, p = sql + " AND " + cond, p + [val]
    if f.get("open_only"):
        sql += " AND a.status IN ('open','in_progress')"
    views = []
    for r in conn.execute(sql + " ORDER BY a.target_date, a.id", p):
        v = _action_view(conn, r)
        c = conn.execute("SELECT b.batch_code,d.category,d.severity FROM defects d JOIN batches b ON b.id=d.batch_id "
                         "WHERE d.id=?", (r["defect_id"],)).fetchone()
        v.update(dict(c))
        views.append(v)
    if f.get("overdue"):
        views = [v for v in views if v["overdue"]]
    return views


@tx
def create_action(conn, user, defect_id, data):
    require(user, "action.assign")
    defect = _need(conn, "defects", defect_id, "Defect")
    if defect["status"] in ("withdrawn", "closed"):
        raise AppError(409, "DEFECT_NOT_ACTIVE", f"This defect is {defect['status']}. Reopen it before adding actions.")
    if review_state(conn, defect["image_id"])[0] != "defect_confirmed":
        raise AppError(409, "NOT_CONFIRMED", "Actions can only be assigned to human-confirmed defects "
                                             "(this one is pending, disputed or withdrawn).")
    owner = _need(conn, "users", data.get("owner_id"), "Owner")
    if owner["role"] not in ("supervisor", "manager") or not owner["active"]:
        raise AppError(422, "INVALID_OWNER", "Corrective actions are owned by an active supervisor or manager.")
    title = _text(data, "title", "Action title", True, 160)
    target = _date(data.get("target_date"), "Target date")
    if target < _today():
        raise AppError(422, "PAST_DATE", "The target date can't be in the past.")
    cur = conn.execute("INSERT INTO corrective_actions(defect_id,owner_id,title,notes,target_date,created_by,created_at) "
                       "VALUES(?,?,?,?,?,?,?)", (defect_id, owner["id"], title, _text(data, "notes", "Notes", False, 1000),
                                                 target, user["id"], now()))
    if defect["status"] == "awaiting_reinspection":
        conn.execute("UPDATE defects SET status='open' WHERE id=?", (defect_id,))
    audit(conn, user["id"], "action", cur.lastrowid, "assigned", detail={"defect_id": defect_id, "owner_id": owner["id"]})
    audit(conn, user["id"], "defect", defect_id, "action_assigned", detail={"action_id": cur.lastrowid})
    return _action_view(conn, _need(conn, "corrective_actions", cur.lastrowid, "Action"))


@tx
def update_action(conn, user, aid, data):
    act = _need(conn, "corrective_actions", aid, "Action")
    is_owner, assigner = act["owner_id"] == user["id"], can(user, "action.assign")
    if not (is_owner or assigner):
        raise AppError(403, "NOT_YOURS", "Only the action owner, an inspector or a manager can update this action.")
    reason, changes = _text(data, "reason", "Reason", False, 500), {}
    new_status = data.get("status")
    if new_status and new_status != act["status"]:
        if new_status not in ACTION_STATUSES or new_status not in ACTION_TRANSITIONS[act["status"]]:
            raise AppError(409, "BAD_TRANSITION", f"An action can't go from '{act['status']}' to '{new_status}'.")
        if new_status == "cancelled" and not (assigner and reason):
            raise AppError(422, "REASON_REQUIRED", "Only an assigner can cancel an action, and a reason is required.")
        changes["status"] = new_status
        if new_status == "done":
            changes["completed_at"] = now()
    for key in ("owner_id", "target_date"):
        if key in data and data[key] != act[key]:
            if not assigner or not reason:
                raise AppError(403, "FORBIDDEN", "Reassigning or rescheduling needs an inspector/manager and a reason.")
            changes[key] = _date(data[key], "Target date") if key == "target_date" else _need(conn, "users", data[key], "Owner")["id"]
    if "notes" in data:
        changes["notes"] = _text(data, "notes", "Notes", False, 1000)
    if not changes:
        raise AppError(422, "NOTHING_TO_UPDATE", "No changes were sent.")
    conn.execute(f"UPDATE corrective_actions SET {','.join(k + '=?' for k in changes)} WHERE id=?", [*changes.values(), aid])
    audit(conn, user["id"], "action", aid, "updated", reason, {k: v for k, v in changes.items()})
    if changes.get("status") == "done":
        defect = conn.execute("SELECT * FROM defects WHERE id=?", (act["defect_id"],)).fetchone()
        still_open = conn.execute("SELECT COUNT(*) FROM corrective_actions WHERE defect_id=? AND status IN "
                                  "('open','in_progress')", (act["defect_id"],)).fetchone()[0]
        if defect["status"] in ("open", "reopened") and not still_open:
            conn.execute("UPDATE defects SET status='awaiting_reinspection' WHERE id=?", (defect["id"],))
            audit(conn, user["id"], "defect", defect["id"], "awaiting_reinspection", "All corrective actions are done")
    return _action_view(conn, _need(conn, "corrective_actions", aid, "Action"))


@tx
def close_defect(conn, user, did, data):
    """Closing needs follow-up evidence: a submitted follow-up inspection whose images are ALL reviewed clean."""
    require(user, "defect.decide")
    defect = _need(conn, "defects", did, "Defect")
    reason = _text(data, "reason", "Reason", True, 500)
    if defect["status"] != "awaiting_reinspection":
        raise AppError(409, "BAD_TRANSITION", f"Only a defect that is awaiting reinspection can be closed (this is '{defect['status']}').")
    fu = conn.execute("SELECT * FROM inspections WHERE follow_up_of_defect_id=? AND status='submitted' ORDER BY id DESC LIMIT 1",
                      (did,)).fetchone()
    if data.get("followup_inspection_id"):
        fu = conn.execute("SELECT * FROM inspections WHERE id=? AND follow_up_of_defect_id=? AND status='submitted'",
                          (data["followup_inspection_id"], did)).fetchone()
    if not fu:
        raise AppError(409, "NO_FOLLOW_UP", "Submit a follow-up inspection linked to this defect before closing it.")
    states = [review_state(conn, r[0])[0] for r in conn.execute(
        "SELECT id FROM images WHERE inspection_id=? AND status='active'", (fu["id"],))]
    if not states or any(s != "no_defect" for s in states):
        raise AppError(409, "FOLLOW_UP_NOT_CLEAR", "Every follow-up image must be reviewed and confirmed defect-free before closing. "
                                                   "If the defect is still present, reopen it instead.")
    conn.execute("UPDATE defects SET status='closed' WHERE id=?", (did,))
    audit(conn, user["id"], "defect", did, "closed", reason, {"follow_up_inspection_id": fu["id"]})
    return get_defect(conn, user, did)


@tx
def reopen_defect(conn, user, did, data):
    require(user, "defect.decide")
    defect = _need(conn, "defects", did, "Defect")
    reason = _text(data, "reason", "Reason", True, 500)
    if defect["status"] not in ("awaiting_reinspection", "closed"):
        raise AppError(409, "BAD_TRANSITION", f"Only a defect that is awaiting reinspection or closed can be reopened (this is '{defect['status']}').")
    conn.execute("UPDATE defects SET status='reopened' WHERE id=?", (did,))
    audit(conn, user["id"], "defect", did, "reopened", reason, {"from": defect["status"]})
    return get_defect(conn, user, did)


# --------------------------------------------------------------------------------------------- queue, dashboard, search
def _collect_images(conn, user, f):
    sql = ("SELECT i.*, n.batch_id, n.inspected_at, n.inspector_id, n.follow_up_of_defect_id, b.batch_code, b.product_id, "
           "p.code AS product_code FROM images i JOIN inspections n ON n.id=i.inspection_id JOIN batches b ON b.id=n.batch_id "
           "JOIN products p ON p.id=b.product_id WHERE i.status='active' AND n.status='submitted'")
    p = []
    for cond, val in (("b.product_id=?", f.get("product_id")), ("n.batch_id=?", f.get("batch_id")),
                      ("substr(n.inspected_at,1,10)>=?", f.get("date_from")), ("substr(n.inspected_at,1,10)<=?", f.get("date_to"))):
        if val not in (None, ""):
            sql, p = sql + " AND " + cond, p + [val]
    cat, owner = f.get("defect_category"), f.get("action_owner_id")
    out = []
    for r in conn.execute(sql + " ORDER BY i.id", p):
        if not _can_see_image(conn, user, r["id"]):
            continue
        if cat and not conn.execute("SELECT 1 FROM defects WHERE image_id=? AND category=? AND status!='withdrawn'", (r["id"], cat)).fetchone():
            continue
        if owner and not conn.execute("SELECT 1 FROM defects d JOIN corrective_actions a ON a.defect_id=d.id "
                                      "WHERE d.image_id=? AND a.owner_id=?", (r["id"], owner)).fetchone():
            continue
        state, resolved = review_state(conn, r["id"])
        if f.get("review_state") and state != f["review_state"]:
            continue
        out.append((r, state))
    return out


def review_queue(conn, user, f=None):
    """Images awaiting a human decision, most uncertain/unreliable first (the review-priority innovation)."""
    f = dict(f or {})
    wanted = {f["review_state"]} if f.get("review_state") else {"pending", "needs_more_evidence", "disputed"}
    f.pop("review_state", None)
    rows = []
    for r, state in _collect_images(conn, user, f):
        if state in wanted:
            v = _image_view(conn, r)
            v.update(batch_id=r["batch_id"], batch_code=r["batch_code"], product_code=r["product_code"],
                     inspected_at=r["inspected_at"], is_follow_up=bool(r["follow_up_of_defect_id"]))
            rows.append(v)
    rows.sort(key=lambda v: (-v["priority"], v["id"]))
    return rows


def _week(day):
    d = date.fromisoformat(day[:10])
    return (d - timedelta(days=d.weekday())).isoformat()


def dashboard(conn, user, f=None):
    f = dict(f or {})
    imgs = _collect_images(conn, user, f)
    states = [s for _, s in imgs]
    defects = list_defects(conn, user, f)
    confirmed = [d for d in defects if d["review_state"] == "defect_confirmed"]
    acts = list_actions(conn, user, f)
    failed = 0
    for r, s in imgs:
        run = _latest_run(conn, r["id"])
        failed += int(run is not None and run["status"] == "failed" and s in ("pending", "needs_more_evidence"))
    base = [(r, s) for r, s in imgs if r["image_kind"] == "item" and not r["follow_up_of_defect_id"]]
    stats = item_stats([((r["batch_id"], r["sample_ref"]), s) for r, s in base])
    first_seen, per_item = {}, {}
    for r, s in base:
        key = (r["batch_id"], r["sample_ref"])
        per_item.setdefault(key, []).append(s)
        first_seen[key] = min(first_seen.get(key, "9999"), r["inspected_at"])
    weeks = {}
    for key, sts in per_item.items():
        st = _item_state(sts)
        if st in ("clear", "defect_confirmed"):
            w = weeks.setdefault(_week(first_seen[key]), {"items_reviewed": 0, "items_with_defect": 0})
            w["items_reviewed"] += 1
            w["items_with_defect"] += st == "defect_confirmed"
    trend = [{"week_start": k, **v, "defect_rate": round(v["items_with_defect"] / v["items_reviewed"], 4)}
             for k, v in sorted(weeks.items())]
    return {
        "cards": {
            "pending_reviews": states.count("pending"), "needs_more_evidence": states.count("needs_more_evidence"),
            "disputed": states.count("disputed"), "failed_ai_runs": failed,
            "confirmed_defects": len(confirmed),
            "awaiting_reinspection": sum(d["status"] == "awaiting_reinspection" for d in confirmed),
            "reopened_defects": sum(d["status"] == "reopened" for d in confirmed),
            "recurring_defects": sum(bool(d["recurrence_of"]) for d in confirmed),
            "open_actions": sum(a["status"] in ("open", "in_progress") for a in acts),
            "overdue_actions": sum(a["overdue"] for a in acts)},
        "items": stats, "trend": trend, "rate_definition": RATE_DEFINITION,
        "trend_note": "Weekly defect rate = items with confirmed defect / items fully reviewed that week, "
                      "so more inspections alone do not raise the rate.",
        "recent_activity": list_audit(conn, user, None, None, 12)}


def list_audit(conn, user, entity=None, entity_id=None, limit=50):
    sql, p = ("SELECT a.*, u.full_name AS actor_name FROM audit_log a LEFT JOIN users u ON u.id=a.actor_id WHERE 1=1"), []
    if entity:
        sql, p = sql + " AND a.entity=?", p + [entity]
    if entity_id:
        sql, p = sql + " AND a.entity_id=?", p + [entity_id]
    rows = conn.execute(sql + " ORDER BY a.id DESC", p).fetchall()
    if _is_sup(user):
        dids = _sup_defect_ids(conn, user)
        aids = {r[0] for r in conn.execute("SELECT id FROM corrective_actions WHERE owner_id=?", (user["id"],))}
        rows = [r for r in rows if r["actor_id"] == user["id"] or (r["entity"] == "defect" and r["entity_id"] in dids)
                or (r["entity"] == "action" and r["entity_id"] in aids)]
    return [dict(r) for r in rows[:limit]]


def search(conn, user, q):
    q = (q or "").strip()
    if len(q) < 2:
        raise AppError(422, "QUERY_TOO_SHORT", "Type at least 2 characters to search.")
    like, out = f"%{q}%", []
    for r in conn.execute("SELECT * FROM products WHERE code LIKE ? OR name LIKE ? LIMIT 10", (like, like)):
        if not _is_sup(user):
            out.append({"type": "product", "id": r["id"], "title": f"{r['code']} - {r['name']}", "subtitle": r["status"]})
    for r in conn.execute("SELECT * FROM batches WHERE batch_code LIKE ? LIMIT 10", (like,)):
        if _can_see_batch(conn, user, r["id"]):
            out.append({"type": "batch", "id": r["id"], "title": r["batch_code"], "subtitle": f"qty {r['quantity']}"})
    for r in conn.execute("SELECT n.*, b.batch_code FROM inspections n JOIN batches b ON b.id=n.batch_id "
                          "WHERE n.notes LIKE ? OR CAST(n.id AS TEXT)=? LIMIT 10", (like, q)):
        if _can_see_inspection(conn, user, r):
            out.append({"type": "inspection", "id": r["id"], "title": f"Inspection #{r['id']} ({r['batch_code']})",
                        "subtitle": r["inspected_at"][:10]})
    for v in list_defects(conn, user, {})[:200]:
        if q.lower() in f"{v['category']} {v['description'] or ''} {v['batch_code']}".lower():
            out.append({"type": "defect", "id": v["id"], "title": f"Defect #{v['id']} - {v['category']}",
                        "subtitle": f"{v['batch_code']} - {v['status']}"})
    return out[:40]


def meta():
    return {"defect_categories": DEFECT_CATEGORIES, "severities": SEVERITIES, "image_kinds": IMAGE_KINDS,
            "decisions": DECISIONS, "ai": ml_engine.status(), "blur_threshold": config.blur_threshold(),
            "max_upload_mb": config.MAX_UPLOAD_BYTES // (1024 * 1024),
            "formats": sorted(config.ALLOWED_FORMATS)}
