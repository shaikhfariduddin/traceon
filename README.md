# Tile Quality Inspection & Defect Tracking System

Buildathon 2.0 web application for **tile manufacturing / installation quality inspection**. It replaces disconnected photographs, spreadsheets, and repair notes with one traceable workflow:

**Register Product & Batch â†’ Upload Images & Notes â†’ AI Suggestion â†’ Human Review â†’ Corrective Action â†’ Reinspection â†’ Dashboard & Cited Report**

## Main features

- Role-based JWT auth: Inspector, Supervisor, Manager (backend-enforced)
- Product and batch registration, archive, hold/release decisions
- Multi-image inspection upload with OpenCV quality checks
- PyTorch tile classifier (`good` plus dataset defect classes) stored separately from human review
- Defect tracking, assigned corrective actions, completion notes, close/reopen
- Follow-up reinspection that never deletes original evidence
- Dashboard counts **distinct tiles**, not photographs
- Evidence-based inspection priority queue (explainable scores)
- Grounded GenAI Q&A and batch reports with database citations

## Technology stack

- Frontend: React, Vite, Tailwind CSS, React Router, Axios
- Backend: FastAPI, Pydantic, SQLAlchemy 2.x, Alembic, JWT
- Database: PostgreSQL
- ML: PyTorch transfer learning, OpenCV, scikit-learn
- GenAI: permission-aware SQL retrieval; optional OpenAI key, otherwise a deterministic grounded fallback

## Dataset

Place (or keep) the MVTec-style tile dataset at:

`C:\Users\PIYUSH\Downloads\tile\tile`

Observed structure after inspection: `train/` and `test/` folders with class directories `good`, `crack`, `glue_strip`, `gray_stroke`, `oil`, `rough`. The model **only** predicts those supported labels. Installation issues such as grout spacing or alignment are captured with the **manual checklist**.

Do not commit dataset images.

## Local setup (Windows PowerShell)

### 1. PostgreSQL

Either use an existing local Postgres instance or:

```powershell
docker compose up -d postgres
```

Create the database if it does not exist (`tile_quality_db`, user `postgres`, password `admin@123`).

### 2. Environment

Copy `.env.example` values into `backend/.env` if needed. Default demo database settings:

```
DB_HOST=localhost
DB_PORT=5432
DB_NAME=tile_quality_db
DB_USER=postgres
DB_PASSWORD=admin@123
```

Leave `OPENAI_API_KEY` empty unless you have a key. The RAG engine still answers from PostgreSQL records.

### 3. Backend

```powershell
cd "C:\Users\PIYUSH\Desktop\Defect Tracking\backend"
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
python -m alembic upgrade head
python -m app.db.init_db
python -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

API docs: http://127.0.0.1:8000/api/docs
Health: http://127.0.0.1:8000/api/health

### 4. Frontend

```powershell
cd "C:\Users\PIYUSH\Desktop\Defect Tracking\frontend"
npm install
npm run dev
```

Open http://127.0.0.1:5173

### 5. Train / evaluate the model (optional if artifacts exist)

```powershell
cd "C:\Users\PIYUSH\Desktop\Defect Tracking\backend"
python -m app.ml.dataset_manifest
python -m app.ml.train
python -m app.ml.evaluate
```

Artifacts are written to `model_artifacts/`. Evaluation evidence is in `docs/ml-evaluation.md`.

## Demo accounts

| Role | Username | Password |
| --- | --- | --- |
| Inspector | inspector | inspector123 |
| Supervisor | supervisor | supervisor123 |
| Manager | manager | manager123 |

Use the login screen one-click buttons, or the navbar role switcher during judging.

## Tests

```powershell
cd "C:\Users\PIYUSH\Desktop\Defect Tracking"
python -m pytest backend/tests/test_all.py -v
cd frontend
npm run build
```

## Known limitations

- Priority-queue usability study vs FIFO is implemented as a **backend simulation**; live shop-floor time-to-detect experiments are labelled unevaluated unless `status` is `evaluated`.
- GenAI does not invent records. Without an LLM API key it uses a deterministic grounded composer, not fabricated chat.
- Image-level classification is **not** proof that a room, floor, or entire batch is defect-free.
- Small / imbalanced tile dataset: do not over-generalise reported metrics.

## Documentation

- `docs/architecture.md`
- `docs/database-schema.md`
- `docs/api-documentation.md`
- `docs/ml-evaluation.md`
- `docs/genai-evaluation.md`
- `docs/presentation-slides.md`
