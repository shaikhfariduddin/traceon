"""HTTP layer. Routes are thin: authentication, parsing, then a call into services.py where every rule is enforced."""
from typing import Optional

from fastapi import Body, Depends, FastAPI, File, Form, Header, Query, Request, UploadFile
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse

from . import config, db, genai, security, services
from .errors import AppError

app = FastAPI(title="Traceon - tile inspection & defect tracking", version="1.0.0",
              description="Decision support for visual tile inspection. AI output is a suggestion; humans decide.")
app.add_middleware(CORSMiddleware, allow_origins=config.CORS_ORIGINS, allow_methods=["*"], allow_headers=["*"],
                   expose_headers=["Content-Disposition"])


@app.on_event("startup")
def _startup():
    conn = db.connect()
    db.init_db(conn)
    conn.close()
    config.UPLOAD_DIR.mkdir(parents=True, exist_ok=True)


@app.exception_handler(AppError)
async def _app_error(_: Request, exc: AppError):
    return JSONResponse(status_code=exc.status, content={"error": {"code": exc.code, "message": exc.message}})


@app.exception_handler(RequestValidationError)
async def _validation(_: Request, exc: RequestValidationError):
    fields = ", ".join(".".join(str(p) for p in e["loc"][1:]) or "body" for e in exc.errors())
    return JSONResponse(status_code=422, content={"error": {"code": "INVALID_REQUEST",
                                                            "message": f"Check these fields: {fields}."}})


def get_conn():
    conn = db.connect()
    try:
        yield conn
    finally:
        conn.close()


def current_user(authorization: Optional[str] = Header(None), conn=Depends(get_conn)):
    if not authorization or not authorization.lower().startswith("bearer "):
        raise AppError(401, "NOT_SIGNED_IN", "Sign in to continue.")
    return services.get_user(conn, security.read_token(authorization[7:]))


def filters(product_id: Optional[int] = None, batch_id: Optional[int] = None, date_from: Optional[str] = None,
            date_to: Optional[str] = None, defect_category: Optional[str] = None, review_state: Optional[str] = None,
            action_owner_id: Optional[int] = None, status: Optional[str] = None, overdue: Optional[bool] = None,
            open_only: Optional[bool] = None, recurring: Optional[bool] = None):
    return {k: v for k, v in dict(product_id=product_id, batch_id=batch_id, date_from=date_from, date_to=date_to,
                                  defect_category=defect_category, review_state=review_state,
                                  action_owner_id=action_owner_id, status=status, overdue=overdue,
                                  open_only=open_only, recurring=recurring).items() if v not in (None, "")}


# ------------------------------------------------------------------------------------------ auth & meta
@app.get("/api/health")
def health():
    return {"ok": True}


@app.post("/api/auth/login")
def login(payload: dict = Body(...), conn=Depends(get_conn)):
    return services.authenticate(conn, payload.get("username"), payload.get("password"))


@app.get("/api/me")
def me(user=Depends(current_user)):
    return services.public_user(user)


@app.get("/api/meta")
def meta(user=Depends(current_user)):
    return services.meta()


@app.get("/api/users")
def users(role: Optional[str] = None, user=Depends(current_user), conn=Depends(get_conn)):
    return services.list_users(conn, user, role)


# ------------------------------------------------------------------------------------------ products & batches
@app.get("/api/products")
def products(include_archived: bool = False, q: Optional[str] = None, user=Depends(current_user), conn=Depends(get_conn)):
    return services.list_products(conn, user, include_archived, q)


@app.post("/api/products", status_code=201)
def product_create(payload: dict = Body(...), user=Depends(current_user), conn=Depends(get_conn)):
    return services.create_product(conn, user, payload)


@app.get("/api/products/{pid}")
def product_get(pid: int, user=Depends(current_user), conn=Depends(get_conn)):
    return services.get_product(conn, user, pid)


@app.patch("/api/products/{pid}")
def product_update(pid: int, payload: dict = Body(...), user=Depends(current_user), conn=Depends(get_conn)):
    return services.update_product(conn, user, pid, payload)


@app.post("/api/products/{pid}/archive")
def product_archive(pid: int, payload: dict = Body(...), user=Depends(current_user), conn=Depends(get_conn)):
    return services.archive_product(conn, user, pid, payload)


@app.get("/api/batches")
def batches(product_id: Optional[int] = None, include_archived: bool = False, q: Optional[str] = None,
            user=Depends(current_user), conn=Depends(get_conn)):
    return services.list_batches(conn, user, product_id, include_archived, q)


@app.post("/api/batches", status_code=201)
def batch_create(payload: dict = Body(...), user=Depends(current_user), conn=Depends(get_conn)):
    return services.create_batch(conn, user, payload)


@app.get("/api/batches/{bid}")
def batch_get(bid: int, user=Depends(current_user), conn=Depends(get_conn)):
    return services.get_batch(conn, user, bid)


@app.patch("/api/batches/{bid}")
def batch_update(bid: int, payload: dict = Body(...), user=Depends(current_user), conn=Depends(get_conn)):
    return services.update_batch(conn, user, bid, payload)


@app.post("/api/batches/{bid}/archive")
def batch_archive(bid: int, payload: dict = Body(...), user=Depends(current_user), conn=Depends(get_conn)):
    return services.archive_batch(conn, user, bid, payload)


@app.post("/api/batches/{bid}/decisions", status_code=201)
def batch_decide(bid: int, payload: dict = Body(...), user=Depends(current_user), conn=Depends(get_conn)):
    return services.record_batch_decision(conn, user, bid, payload)


# ------------------------------------------------------------------------------------------ inspections & images
@app.get("/api/inspections")
def inspections(batch_id: Optional[int] = None, status: Optional[str] = None, date_from: Optional[str] = None,
                date_to: Optional[str] = None, inspector_id: Optional[int] = None, product_id: Optional[int] = None,
                q: Optional[str] = None, user=Depends(current_user), conn=Depends(get_conn)):
    return services.list_inspections(conn, user, batch_id, status, date_from, date_to, inspector_id, product_id, q)


@app.post("/api/inspections", status_code=201)
def inspection_create(payload: dict = Body(...), idempotency_key: Optional[str] = Header(None),
                      user=Depends(current_user), conn=Depends(get_conn)):
    return services.create_inspection(conn, user, payload, idempotency_key)


@app.get("/api/inspections/{iid}")
def inspection_get(iid: int, user=Depends(current_user), conn=Depends(get_conn)):
    return services.get_inspection(conn, user, iid)


@app.patch("/api/inspections/{iid}")
def inspection_update(iid: int, payload: dict = Body(...), user=Depends(current_user), conn=Depends(get_conn)):
    return services.update_inspection_notes(conn, user, iid, payload)


@app.delete("/api/inspections/{iid}")
def inspection_delete(iid: int, user=Depends(current_user), conn=Depends(get_conn)):
    return services.delete_draft(conn, user, iid)


@app.post("/api/inspections/{iid}/submit")
def inspection_submit(iid: int, user=Depends(current_user), conn=Depends(get_conn)):
    return services.submit_inspection(conn, user, iid)


@app.post("/api/inspections/{iid}/archive")
def inspection_archive(iid: int, payload: dict = Body(...), user=Depends(current_user), conn=Depends(get_conn)):
    return services.archive_inspection(conn, user, iid, payload)


@app.post("/api/inspections/{iid}/images", status_code=201)
def image_upload(iid: int, file: UploadFile = File(...), sample_ref: str = Form(...), image_kind: str = Form(...),
                 user=Depends(current_user), conn=Depends(get_conn)):
    data = file.file.read(config.MAX_UPLOAD_BYTES + 1)          # never read an unbounded body into memory
    return services.upload_image(conn, user, iid, data, file.filename, sample_ref, image_kind)


@app.get("/api/images/{image_id}")
def image_get(image_id: int, user=Depends(current_user), conn=Depends(get_conn)):
    return services.get_image(conn, user, image_id)


@app.get("/api/images/{image_id}/file")
def image_file(image_id: int, run_id: Optional[int] = None, user=Depends(current_user), conn=Depends(get_conn)):
    path, mime = services.image_file_path(conn, user, image_id, run_id)
    if not path.exists():
        raise AppError(404, "FILE_MISSING", "The stored file is missing on the server.")
    return FileResponse(path, media_type=mime)


@app.post("/api/images/{image_id}/process")
def image_reprocess(image_id: int, user=Depends(current_user), conn=Depends(get_conn)):
    return services.retry_processing(conn, user, image_id)


@app.post("/api/images/{image_id}/reviews", status_code=201)
def image_review(image_id: int, payload: dict = Body(...), user=Depends(current_user), conn=Depends(get_conn)):
    return services.submit_review(conn, user, image_id, payload)


@app.post("/api/images/{image_id}/resolve", status_code=201)
def image_resolve(image_id: int, payload: dict = Body(...), user=Depends(current_user), conn=Depends(get_conn)):
    return services.resolve_dispute(conn, user, image_id, payload)


@app.get("/api/reviews/queue")
def review_queue(f=Depends(filters), user=Depends(current_user), conn=Depends(get_conn)):
    return services.review_queue(conn, user, f)


# ------------------------------------------------------------------------------------------ defects & actions
@app.get("/api/defects")
def defects(f=Depends(filters), user=Depends(current_user), conn=Depends(get_conn)):
    return services.list_defects(conn, user, f)


@app.get("/api/defects/{did}")
def defect_get(did: int, user=Depends(current_user), conn=Depends(get_conn)):
    return services.get_defect(conn, user, did)


@app.post("/api/defects/{did}/actions", status_code=201)
def action_create(did: int, payload: dict = Body(...), user=Depends(current_user), conn=Depends(get_conn)):
    return services.create_action(conn, user, did, payload)


@app.post("/api/defects/{did}/close")
def defect_close(did: int, payload: dict = Body(...), user=Depends(current_user), conn=Depends(get_conn)):
    return services.close_defect(conn, user, did, payload)


@app.post("/api/defects/{did}/reopen")
def defect_reopen(did: int, payload: dict = Body(...), user=Depends(current_user), conn=Depends(get_conn)):
    return services.reopen_defect(conn, user, did, payload)


@app.get("/api/actions")
def actions(f=Depends(filters), user=Depends(current_user), conn=Depends(get_conn)):
    return services.list_actions(conn, user, f)


@app.patch("/api/actions/{aid}")
def action_update(aid: int, payload: dict = Body(...), user=Depends(current_user), conn=Depends(get_conn)):
    return services.update_action(conn, user, aid, payload)


# ------------------------------------------------------------------------------------------ dashboard, search, history, GenAI
@app.get("/api/dashboard")
def dashboard(f=Depends(filters), user=Depends(current_user), conn=Depends(get_conn)):
    return services.dashboard(conn, user, f)


@app.get("/api/search")
def search(q: str = Query(...), user=Depends(current_user), conn=Depends(get_conn)):
    return services.search(conn, user, q)


@app.get("/api/audit")
def audit_log(entity: Optional[str] = None, entity_id: Optional[int] = None, limit: int = 50,
              user=Depends(current_user), conn=Depends(get_conn)):
    return services.list_audit(conn, user, entity, entity_id, min(limit, 200))


@app.post("/api/assistant/ask")
def assistant_ask(payload: dict = Body(...), user=Depends(current_user), conn=Depends(get_conn)):
    return genai.ask(conn, user, payload.get("question"))


@app.post("/api/assistant/report")
def assistant_report(payload: dict = Body(default={}), user=Depends(current_user), conn=Depends(get_conn)):
    return genai.report(conn, user, payload.get("start"), payload.get("end"))
