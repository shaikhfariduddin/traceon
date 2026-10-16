# Live demo script (about 8 minutes)
1. Login `manager`: create product/batch (Products & batches).
2. Login `inspector`: new inspection on the batch, upload an **unseen MVTec test image** -> show stored AI result, score bar and heat map. Submit.
3. Review queue: show priority order; confirm or **correct** the AI with a reason; pick the category yourself (AI only says normal/unusual).
4. Login `manager`: assign a corrective action to `supervisor`. Show a refused action: log in as `supervisor` and try to open the review queue / record a batch decision (403 message).
5. `supervisor`: mark action done, submit follow-up evidence (a good tile). `inspector`: review it clean. `manager`: close the defect; show history; reopen to demonstrate reopening.
6. Failure paths: upload a corrupt file and a duplicate; stop the model (rename `ml/artifacts/tile_patchcore.pt`) and upload -> "AI unavailable, manual review", then restore and use *Retry AI*.
7. Dashboard: filters, cards open source records, weekly rate with n/d, recurrence flag.
8. Assistant: supported question, unknown batch, misleading premise, unauthorised (as `supervisor2`), then "Draft a quality report".
9. Innovation: show `ml/reports/priority_eval.md` and explain the result honestly.
