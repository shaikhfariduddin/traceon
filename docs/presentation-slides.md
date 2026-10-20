# Six-slide judging outline

Use live screenshots from the running app. Do not invent metrics.

## 1. Problem and solution

Disconnected tile photos and spreadsheets. Single workflow: register â†’ inspect â†’ AI suggestion â†’ human confirm â†’ correct â†’ reinspect â†’ cited report.

## 2. Architecture

React/Vite UI, FastAPI, PostgreSQL, local image store, PyTorch classifier, permission-aware RAG.

## 3. Core implementation

Normalised schema, JWT roles, audit history, separate `model_results` and `reviews`, batch decisions independent of tile outcomes.

## 4. AI/ML and GenAI

Dataset classes: good / crack / glue_strip / gray_stroke / oil / rough. Held-out metrics in `docs/ml-evaluation.md`. GenAI answers only from authorised records plus citations.

## 5. Innovation

Evidence-based priority queue with documented weights. FIFO vs priority simulation in `/priority-queue`. Manual checklist for installation defects the model cannot classify.

## 6. Demo and impact

Login as inspector â†’ upload unseen tile â†’ show model version â†’ confirm/correct â†’ manager dispute â†’ assign action â†’ reinspect â†’ dashboard counts distinct tiles â†’ GenAI citation â†’ 403 on unauthorised batch release.
