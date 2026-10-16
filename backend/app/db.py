"""SQLite persistence. Plain parameterised SQL keeps the data model visible and easy to explain."""
import json
import sqlite3
from datetime import datetime, timezone
from pathlib import Path

from . import config

SCHEMA = """
CREATE TABLE IF NOT EXISTS users(
  id INTEGER PRIMARY KEY, username TEXT UNIQUE NOT NULL, full_name TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('inspector','supervisor','manager')),
  password_hash TEXT NOT NULL, active INTEGER NOT NULL DEFAULT 1);

CREATE TABLE IF NOT EXISTS products(
  id INTEGER PRIMARY KEY, code TEXT UNIQUE NOT NULL, name TEXT NOT NULL, category TEXT NOT NULL,
  supplier TEXT, production_line TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','archived')),
  created_at TEXT NOT NULL, created_by INTEGER NOT NULL REFERENCES users(id));

CREATE TABLE IF NOT EXISTS batches(
  id INTEGER PRIMARY KEY, product_id INTEGER NOT NULL REFERENCES products(id),
  batch_code TEXT UNIQUE NOT NULL, produced_date TEXT NOT NULL,
  quantity INTEGER NOT NULL CHECK(quantity > 0), production_line TEXT, supplier TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','archived')),
  created_at TEXT NOT NULL, created_by INTEGER NOT NULL REFERENCES users(id));

CREATE TABLE IF NOT EXISTS inspections(
  id INTEGER PRIMARY KEY, batch_id INTEGER NOT NULL REFERENCES batches(id),
  inspector_id INTEGER NOT NULL REFERENCES users(id), inspected_at TEXT NOT NULL,
  notes TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','submitted','archived')),
  follow_up_of_defect_id INTEGER, idem_key TEXT, created_at TEXT NOT NULL,
  UNIQUE(inspector_id, idem_key));

CREATE TABLE IF NOT EXISTS inspection_revisions(
  id INTEGER PRIMARY KEY, inspection_id INTEGER NOT NULL REFERENCES inspections(id),
  version INTEGER NOT NULL, notes TEXT NOT NULL, edited_by INTEGER NOT NULL REFERENCES users(id),
  edited_at TEXT NOT NULL, reason TEXT);

CREATE TABLE IF NOT EXISTS images(
  id INTEGER PRIMARY KEY, inspection_id INTEGER NOT NULL REFERENCES inspections(id),
  sample_ref TEXT NOT NULL, image_kind TEXT NOT NULL CHECK(image_kind IN ('item','surface','batch_sample')),
  original_name TEXT NOT NULL, stored_name TEXT NOT NULL, sha256 TEXT NOT NULL, mime TEXT NOT NULL,
  width INTEGER NOT NULL, height INTEGER NOT NULL, size_bytes INTEGER NOT NULL,
  blur_score REAL, low_quality INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','archived')),
  uploaded_by INTEGER NOT NULL REFERENCES users(id), uploaded_at TEXT NOT NULL,
  UNIQUE(inspection_id, sha256));

CREATE TABLE IF NOT EXISTS model_runs(
  id INTEGER PRIMARY KEY, image_id INTEGER NOT NULL REFERENCES images(id), attempt_no INTEGER NOT NULL,
  model_name TEXT, model_version TEXT, status TEXT NOT NULL CHECK(status IN ('ok','failed')),
  predicted_label TEXT CHECK(predicted_label IN ('good','defective','uncertain')),
  score REAL, threshold REAL, processing_ms INTEGER, heatmap_name TEXT, error TEXT,
  triggered_by INTEGER REFERENCES users(id), created_at TEXT NOT NULL);

CREATE TABLE IF NOT EXISTS reviews(
  id INTEGER PRIMARY KEY, image_id INTEGER NOT NULL REFERENCES images(id),
  model_run_id INTEGER REFERENCES model_runs(id), reviewer_id INTEGER NOT NULL REFERENCES users(id),
  kind TEXT NOT NULL DEFAULT 'review' CHECK(kind IN ('review','resolution')),
  decision TEXT NOT NULL CHECK(decision IN ('no_defect','defect_confirmed','needs_more_evidence')),
  defect_category TEXT, severity TEXT, description TEXT, reason TEXT,
  agrees_with_ai INTEGER, created_at TEXT NOT NULL);

CREATE TABLE IF NOT EXISTS defects(
  id INTEGER PRIMARY KEY, image_id INTEGER NOT NULL REFERENCES images(id),
  batch_id INTEGER NOT NULL REFERENCES batches(id), category TEXT NOT NULL, severity TEXT NOT NULL,
  description TEXT, status TEXT NOT NULL DEFAULT 'open'
    CHECK(status IN ('open','awaiting_reinspection','closed','reopened','withdrawn')),
  recurrence_of INTEGER, created_by INTEGER NOT NULL REFERENCES users(id), created_at TEXT NOT NULL);

CREATE TABLE IF NOT EXISTS corrective_actions(
  id INTEGER PRIMARY KEY, defect_id INTEGER NOT NULL REFERENCES defects(id),
  owner_id INTEGER NOT NULL REFERENCES users(id), title TEXT NOT NULL, notes TEXT,
  target_date TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('open','in_progress','done','cancelled')),
  created_by INTEGER NOT NULL REFERENCES users(id), created_at TEXT NOT NULL, completed_at TEXT);

CREATE TABLE IF NOT EXISTS batch_decisions(
  id INTEGER PRIMARY KEY, batch_id INTEGER NOT NULL REFERENCES batches(id),
  decision TEXT NOT NULL CHECK(decision IN ('hold','release')), reason TEXT NOT NULL,
  decided_by INTEGER NOT NULL REFERENCES users(id), decided_at TEXT NOT NULL,
  items_inspected INTEGER NOT NULL, items_reviewed INTEGER NOT NULL,
  pending_items INTEGER NOT NULL, open_defects INTEGER NOT NULL);

CREATE TABLE IF NOT EXISTS audit_log(
  id INTEGER PRIMARY KEY, at TEXT NOT NULL, actor_id INTEGER REFERENCES users(id),
  entity TEXT NOT NULL, entity_id INTEGER, action TEXT NOT NULL, reason TEXT, detail TEXT);

CREATE INDEX IF NOT EXISTS ix_batches_product ON batches(product_id);
CREATE INDEX IF NOT EXISTS ix_insp_batch ON inspections(batch_id);
CREATE INDEX IF NOT EXISTS ix_img_insp ON images(inspection_id);
CREATE INDEX IF NOT EXISTS ix_runs_img ON model_runs(image_id);
CREATE INDEX IF NOT EXISTS ix_rev_img ON reviews(image_id);
CREATE INDEX IF NOT EXISTS ix_def_batch ON defects(batch_id);
CREATE INDEX IF NOT EXISTS ix_act_def ON corrective_actions(defect_id);
CREATE INDEX IF NOT EXISTS ix_audit_entity ON audit_log(entity, entity_id);
"""


def now() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def connect(path=None) -> sqlite3.Connection:
    path = str(path or config.DB_PATH)
    if path != ":memory:":
        Path(path).parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(path, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys=ON")
    if path != ":memory:":
        conn.execute("PRAGMA journal_mode=WAL")
    return conn


def init_db(conn: sqlite3.Connection) -> None:
    conn.executescript(SCHEMA)
    conn.commit()


def audit(conn, actor_id, entity, entity_id, action, reason=None, detail=None) -> None:
    """Append-only history: who did what, when and why."""
    conn.execute(
        "INSERT INTO audit_log(at,actor_id,entity,entity_id,action,reason,detail) VALUES(?,?,?,?,?,?,?)",
        (now(), actor_id, entity, entity_id, action, reason, json.dumps(detail) if detail is not None else None),
    )
