# Architecture

```text
Inspector / Manager (React + Vite)
        |  JWT  /api  + /uploads proxy
        v
FastAPI  â€”  Auth, Products, Batches, Inspections, ML predict, Reviews,
            Defects, Actions, Dashboard, Priority queue, GenAI RAG
        |
        +--> PostgreSQL (records, hashes, paths, audit)
        +--> Local filesystem (original photographs)
        +--> PyTorch TileDefectClassifier
        +--> Optional LLM (server-side only)
```

## Data flow

1. Authorised user registers a product and batch.
2. Inspector creates an inspection, uploads images (validated, hashed, quality-scored).
3. Inference writes a **new** `model_results` row; earlier results stay with `is_current=false`.
4. Human review writes a **new** `reviews` row and may open a defect.
5. Supervisor/manager assigns corrective actions; completion does **not** close the defect.
6. Reinspection creates a linked follow-up inspection; originals remain.
7. Dashboard and GenAI read authorised SQL; LLM never executes SQL or issues batch decisions.

## Priority rules (innovation)

Scores are computed from stored evidence only:

- Overdue corrective action: +100
- Reopened confirmed defect: +80
- Unresolved dispute: +70
- Recurring batch defect category: +40
- Pending human review: +30
- Poor image quality / uncertain: +25

Unreviewed ML predictions are **not** treated as confirmed defects.
