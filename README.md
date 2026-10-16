# Traceon - tile inspection & defect tracking

Buildathon 2.0, third-year track, Problem Statement 01 (Product Quality Inspection & Defect Tracking).
**Setting:** glazed porcelain floor tiles, one organisation. Visual-inspection *decision support*: AI suggests, people decide.

| Layer | Technology |
|---|---|
| Backend / API | Python 3, FastAPI, SQLite (plain SQL) |
| Frontend | React 18 + Vite |
| ML | PyTorch / torchvision (pretrained ResNet18), scikit-learn for evaluation |
| GenAI | Retrieval from the database + grounded text; optional hosted LLM (Anthropic API) |

## What it does (maps to the problem statement)
| Requirement | Where |
|---|---|
| A. Products & batches (create/edit/archive) | `services.py` products/batches, UI "Products & batches" |
| B. Inspections & images (item / surface / batch sample, originals kept, draft corrections as revisions) | `create_inspection`, `upload_image`, `update_inspection_notes` |
| C. ML result beside image; human confirm/correct/request evidence; machine output stored separately | `model_runs` vs `reviews` tables, UI "Review queue" |
| D. Defects, corrective actions, follow-up inspections, close / reopen without deleting | `defects`, `corrective_actions`, `close_defect`, `reopen_defect` |
| E. Batch hold/release as a separate human decision, with item counts | `record_batch_decision`, `batch_coverage` |
| F. Dashboard and search with filters, trend, links to source records | `dashboard`, `search` |
| G. API & integrity (server-side permissions, status transitions, idempotency, clear errors) | `main.py` + `services.py`, tests |
| H. History & recovery (audit log, failed AI attempts kept, retry, archived products keep history) | `audit_log`, `model_runs`, `retry_processing` |
| AI/ML: visual anomaly detection (PatchCore-style) on MVTec AD **tile** | `ml/tileml.py`, `ml/train.py` |
| GenAI: grounded summaries / attention / history / report with citations | `backend/app/genai.py` |
| Innovation: review-priority queue (measured) | `ml/priority.py`, `ml/eval_priority.py`, `docs/INNOVATION.md` |

Roles (enforced in the backend, not only the UI): **inspector**, **supervisor**, **manager** - see `PERMISSIONS` in `backend/app/security.py` and the matrix in `docs/ARCHITECTURE.md`.

## Setup (local)
Python 3.10+ and Node 18+.

```bash
# 1. backend
python -m venv .venv && source .venv/bin/activate        # Windows: .venv\Scripts\activate
pip install -r ml/requirements.txt                       # includes backend requirements + PyTorch
cp .env.example .env                                     # and edit TRACEON_SECRET

# 2. run the tests (no PyTorch needed for these)
python -m unittest discover -s backend/tests -v

# 3. train the model (needs the dataset, see below) - takes a few minutes on CPU
python -m ml.train --data datasets/mvtec_anomaly_detection --category tile
python -m ml.eval_priority                                # measures the innovation

# 4. demo data, then start the API
python backend/seed.py --reset --mvtec datasets/mvtec_anomaly_detection
cd backend && uvicorn app.main:app --reload --port 8000

# 5. frontend (new terminal)
cd frontend && npm install && npm run dev                # http://localhost:5173
```
Demo accounts (password `demo1234`): `manager`, `inspector`, `inspector2`, `supervisor`, `supervisor2`.
API docs (auto-generated): http://localhost:8000/docs

No dataset yet? `python backend/seed.py --reset` uses clearly labelled **synthetic placeholder** images so you can click through the UI; do not use them for evaluation.
If the model file is missing the app still works: images are stored, the AI run is recorded as **failed**, and reviewers do a manual review (use *Retry AI* after training).

## Dataset
MVTec AD, category `tile` (download from the MVTec site; check terms: CC BY-NC-SA 4.0, non-commercial). Place it under `datasets/` (git-ignored). Normal training images only are used for fitting; the official test set is held out and used once for the report. Demo "unseen evaluation images" come from that test set.

## Honest limitations
* Anomaly detection says "looks unusual compared with normal tiles"; it does **not** name the defect type. The category (crack, glue strip, ...) is chosen by the human reviewer.
* The score is a distance, not a probability; no confidence percentages are shown.
* Threshold calibration uses few normal images; see `ml/reports/eval_report.md` after training for what the numbers really are.
* This is decision support, not safety certification; a sampled image never proves the whole batch is good.
* Built with AI coding assistance; the team must be able to explain every module (see `docs/ARCHITECTURE.md`).
