# Git workflow and commit plan

Organisers read your history, so commit as you really work. Do not backdate commits. Suggested order (each bullet = one or more commits; tag the milestones):

1. `chore: repo skeleton, README, .gitignore, .env.example`
2. `feat(db): schema and audit log` -> `feat(auth): login, roles, permission table`
3. `feat(catalog): products and batches CRUD with archive` -> tag `v0.1-catalog`
4. `feat(inspection): inspections, uploads, validation, revisions, idempotency`
5. `feat(ml): training script, evaluation report` -> `feat(ml): engine wrapper, failed-run handling and retry` -> tag `v0.2-ml`
6. `feat(review): review queue, human confirmation separate from ML, disputes`
7. `feat(defects): defects, actions, follow-up, close/reopen, recurrence flag` -> `feat(batch): hold/release decisions`
8. `feat(dashboard): filters, cards, trend, search`
9. `feat(genai): grounded assistant with citations and refusals` -> `test: genai cases`
10. `feat(innovation): review priority and its evaluation` -> tag `v0.3-feature-complete`
11. `docs: architecture, API, evaluation, demo script` -> tag `v1.0-demo`

Commands:
```bash
git init && git branch -M main
git remote add origin https://github.com/<you>/traceon.git
git add . && git commit -m "chore: repo skeleton"
git push -u origin main
git checkout -b feat/review-queue      # one branch per feature; open a pull request; merge to main
git tag v0.2-ml && git push --tags
```
Rules: small commits, clear messages, push at least daily, every teammate commits their own work, never commit `.env`, datasets, `data/` or model weights (they are git-ignored). Mention AI-tool assistance in the README (already done) and make sure you can explain each file.
