# API summary
Interactive docs: `GET /docs` (FastAPI). All routes except `/api/health` and `/api/auth/login` need `Authorization: Bearer <token>`.
Errors: `{"error": {"code": "...", "message": "..."}}` with HTTP 401 / 403 / 404 / 409 / 413 / 415 / 422.

| Area | Endpoints |
|---|---|
| Auth | `POST /api/auth/login`, `GET /api/me`, `GET /api/meta`, `GET /api/users?role=` |
| Products | `GET/POST /api/products`, `GET/PATCH /api/products/{id}`, `POST /api/products/{id}/archive` |
| Batches | `GET/POST /api/batches`, `GET/PATCH /api/batches/{id}`, `POST /api/batches/{id}/archive`, `POST /api/batches/{id}/decisions` |
| Inspections | `GET/POST /api/inspections` (header `Idempotency-Key`), `GET/PATCH/DELETE /api/inspections/{id}`, `POST .../submit`, `POST .../archive`, `POST .../images` (multipart: `file`, `sample_ref`, `image_kind`) |
| Images / ML | `GET /api/images/{id}`, `GET /api/images/{id}/file[?run_id=]` (original or heat map), `POST /api/images/{id}/process` (retry) |
| Review | `GET /api/reviews/queue`, `POST /api/images/{id}/reviews`, `POST /api/images/{id}/resolve` |
| Defects & actions | `GET /api/defects`, `GET /api/defects/{id}`, `POST /api/defects/{id}/actions`, `POST /api/defects/{id}/close`, `POST /api/defects/{id}/reopen`, `GET /api/actions`, `PATCH /api/actions/{id}` |
| Dashboard | `GET /api/dashboard`, `GET /api/search?q=`, `GET /api/audit` |
| GenAI | `POST /api/assistant/ask {question}`, `POST /api/assistant/report {start,end}` |

Filters (dashboard, queue, defects, actions): `product_id, batch_id, date_from, date_to, defect_category, review_state, action_owner_id, status, overdue, open_only, recurring`.

Example review request:
```json
POST /api/images/12/reviews
{"decision":"defect_confirmed","defect_category":"crack","severity":"major",
 "description":"Crack from top edge","reason":"Visible at 100% zoom","model_run_id":31}
```
`model_run_id` guards against reviewing a stale AI result (409 `STALE_RUN`).
