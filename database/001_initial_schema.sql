-- TripMates schema v1 (SQLite). All money columns are INTEGER paise.
PRAGMA foreign_keys = ON;

CREATE TABLE users (
  id INTEGER PRIMARY KEY, email TEXT NOT NULL UNIQUE COLLATE NOCASE, password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('super_admin','family_admin','member')),
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0,1)), created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE families (
  id INTEGER PRIMARY KEY, name TEXT NOT NULL, admin_user_id INTEGER REFERENCES users(id),
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0,1)), created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
-- An individual account. May or may not have a login, may or may not belong to a family.
CREATE TABLE persons (
  id INTEGER PRIMARY KEY, display_name TEXT NOT NULL, user_id INTEGER UNIQUE REFERENCES users(id),
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0,1))
);
CREATE TABLE family_memberships (
  id INTEGER PRIMARY KEY, family_id INTEGER NOT NULL REFERENCES families(id), person_id INTEGER NOT NULL REFERENCES persons(id),
  joined_at TEXT NOT NULL DEFAULT (datetime('now')), left_at TEXT
);
CREATE UNIQUE INDEX ux_membership_active ON family_memberships(person_id) WHERE left_at IS NULL;

CREATE TABLE trips (
  id INTEGER PRIMARY KEY, name TEXT NOT NULL, destination TEXT, start_date TEXT, end_date TEXT, description TEXT, notes TEXT,
  budget_paise INTEGER CHECK (budget_paise IS NULL OR budget_paise >= 0),
  status TEXT NOT NULL DEFAULT 'planning' CHECK (status IN ('planning','upcoming','ongoing','completed')),
  is_private INTEGER NOT NULL DEFAULT 0 CHECK (is_private IN (0,1)),
  created_by INTEGER NOT NULL REFERENCES users(id), completed_at TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE trip_families (trip_id INTEGER NOT NULL REFERENCES trips(id), family_id INTEGER NOT NULL REFERENCES families(id), PRIMARY KEY (trip_id, family_id));
CREATE TABLE trip_participants (
  trip_id INTEGER NOT NULL REFERENCES trips(id), person_id INTEGER NOT NULL REFERENCES persons(id),
  attendance TEXT NOT NULL DEFAULT 'pending' CHECK (attendance IN ('pending','coming','not_coming')),
  responded_at TEXT, PRIMARY KEY (trip_id, person_id)
);
CREATE TABLE attendance_log (
  id INTEGER PRIMARY KEY, trip_id INTEGER NOT NULL, person_id INTEGER NOT NULL, old_value TEXT, new_value TEXT NOT NULL,
  changed_by INTEGER NOT NULL REFERENCES users(id), changed_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- account_type/account_id identify who paid or who owes: a person OR a family, never both.
CREATE TABLE expenses (
  id INTEGER PRIMARY KEY, trip_id INTEGER NOT NULL REFERENCES trips(id), title TEXT NOT NULL, expense_date TEXT NOT NULL,
  category TEXT NOT NULL, currency TEXT NOT NULL DEFAULT 'INR', total_paise INTEGER NOT NULL CHECK (total_paise > 0),
  paid_by_type TEXT NOT NULL CHECK (paid_by_type IN ('person','family')), paid_by_id INTEGER NOT NULL,
  accounting_mode TEXT NOT NULL CHECK (accounting_mode IN ('individual','family','mixed')),
  split_method TEXT NOT NULL CHECK (split_method IN ('equal','per_head','family_wise','individual','individual_remainder','itemized','custom','percentage')),
  notes TEXT, receipt_total_paise INTEGER CHECK (receipt_total_paise IS NULL OR receipt_total_paise >= 0),
  created_by INTEGER NOT NULL REFERENCES users(id), created_at TEXT NOT NULL DEFAULT (datetime('now')), voided_at TEXT
);
CREATE INDEX ix_expenses_trip ON expenses(trip_id);
CREATE TABLE expense_items (
  id INTEGER PRIMARY KEY, expense_id INTEGER NOT NULL REFERENCES expenses(id), name TEXT NOT NULL,
  unit_price_paise INTEGER NOT NULL CHECK (unit_price_paise >= 0), quantity INTEGER NOT NULL CHECK (quantity > 0),
  subtotal_paise INTEGER NOT NULL CHECK (subtotal_paise = unit_price_paise * quantity), notes TEXT
);
CREATE TABLE expense_charges (
  id INTEGER PRIMARY KEY, expense_id INTEGER NOT NULL REFERENCES expenses(id),
  kind TEXT NOT NULL CHECK (kind IN ('tax','service','tip','discount','adjustment')), label TEXT,
  signed_amount_paise INTEGER NOT NULL
);
-- Final saved shares. Historical: never rewritten by attendance or membership changes.
CREATE TABLE expense_allocations (
  id INTEGER PRIMARY KEY, expense_id INTEGER NOT NULL REFERENCES expenses(id),
  account_type TEXT NOT NULL CHECK (account_type IN ('person','family')), account_id INTEGER NOT NULL,
  amount_paise INTEGER NOT NULL CHECK (amount_paise >= 0), UNIQUE (expense_id, account_type, account_id)
);
-- Informational breakdown of a family's share among its members (NOT additional debt).
CREATE TABLE family_share_breakdown (
  id INTEGER PRIMARY KEY, expense_id INTEGER NOT NULL REFERENCES expenses(id), family_id INTEGER NOT NULL REFERENCES families(id),
  person_id INTEGER NOT NULL REFERENCES persons(id), amount_paise INTEGER NOT NULL CHECK (amount_paise >= 0)
);
CREATE TABLE repayments (
  id INTEGER PRIMARY KEY, trip_id INTEGER NOT NULL REFERENCES trips(id),
  from_type TEXT NOT NULL CHECK (from_type IN ('person','family')), from_id INTEGER NOT NULL,
  to_type TEXT NOT NULL CHECK (to_type IN ('person','family')), to_id INTEGER NOT NULL,
  amount_paise INTEGER NOT NULL CHECK (amount_paise > 0), paid_on TEXT NOT NULL, reference TEXT, note TEXT,
  idempotency_key TEXT UNIQUE, recorded_by INTEGER NOT NULL REFERENCES users(id), created_at TEXT NOT NULL DEFAULT (datetime('now')),
  CHECK (NOT (from_type = to_type AND from_id = to_id))
);
CREATE INDEX ix_repayments_trip ON repayments(trip_id);
CREATE TABLE debt_assumptions (
  id INTEGER PRIMARY KEY, trip_id INTEGER NOT NULL REFERENCES trips(id),
  debtor_type TEXT NOT NULL, debtor_id INTEGER NOT NULL, assumed_by_type TEXT NOT NULL, assumed_by_id INTEGER NOT NULL,
  amount_paise INTEGER NOT NULL CHECK (amount_paise > 0), recorded_by INTEGER NOT NULL REFERENCES users(id), created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE audit_log (
  id INTEGER PRIMARY KEY, actor_user_id INTEGER REFERENCES users(id), action TEXT NOT NULL, entity TEXT NOT NULL, entity_id INTEGER,
  before_json TEXT, after_json TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
