# Database schema

Core tables (Alembic `fc3bf46d404f_initial_schema`):

- `users` â€” username, hashed password, role (`inspector`, `supervisor`, `manager`)
- `products` â€” product_code unique, tile type, dimensions, finish, material, is_archived
- `batches` â€” batch_code unique, product_id FK, quantity, supplier, status
- `inspections` â€” batch_id, inspector_id, item_reference, sample_type, notes, status
- `inspection_images` â€” file_path, hash, size, width/height, blur/brightness, is_uncertain
- `model_results` â€” predicted_class, defect_type, score, model version, status, is_current
- `reviews` â€” review_decision, confirmed_category, notes, reviewer_id
- `defects` â€” category, severity, description, status
- `corrective_actions` â€” owner, due_date, status, completion_notes, follow_up_inspection_id
- `batch_decisions` â€” manager hold/release/conditional, reason
- `audit_history` â€” actor, timestamp, entity, action, reason

Relationships: Product 1â€”N Batch 1â€”N Inspection 1â€”N Images / ModelResults / Reviews / Defects. Defect 1â€”N Actions. Actions may link to a follow-up Inspection.
