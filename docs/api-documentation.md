# API documentation

Interactive OpenAPI: `http://127.0.0.1:8000/api/docs`

All routes below sit under `/api` and require a Bearer JWT except `/api/health` and `POST /api/auth/login`.

## Auth

- `POST /api/auth/login`
- `GET /api/auth/me`
- `GET /api/auth/users`

## Products / batches

- `GET|POST /api/products`
- `GET|PATCH /api/products/{id}`
- `POST /api/products/{id}/archive` (manager)
- `GET|POST /api/batches`
- `GET|PATCH /api/batches/{id}`
- `POST /api/batches/{id}/decision` (manager)
- `GET /api/batches/{id}/decisions`

## Inspections

- `GET|POST /api/inspections`
- `GET /api/inspections/{id}`
- `POST /api/inspections/{id}/images`
- `POST /api/inspections/{id}/analyze`
- `POST /api/inspections/{id}/review`
- `POST /api/inspections/{id}/resolve-dispute` (manager)
- `POST /api/inspections/{id}/reinspect`
- `GET /api/inspections/{id}/history`

## Defects / actions

- `GET /api/defects`
- `GET /api/defects/{id}`
- `POST /api/defects/{id}/actions` (supervisor/manager)
- `POST /api/defects/{id}/reopen`
- `PATCH /api/actions/{id}`
- `POST /api/actions/{id}/complete`
- `POST /api/actions/{id}/close-defect` (supervisor/manager)

## Dashboard / GenAI

- `GET /api/dashboard`
- `GET /api/dashboard/priority-queue`
- `GET /api/dashboard/priority-evaluation`
- `POST /api/ai/ask`
- `POST /api/ai/reports`
