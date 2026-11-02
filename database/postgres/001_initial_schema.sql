-- TripMates PostgreSQL Schema v1. All money columns are BIGINT paise.
CREATE EXTENSION IF NOT EXISTS citext;

CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  email CITEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('super_admin','family_admin','member')),
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0,1)),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS families (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  admin_user_id INTEGER REFERENCES users(id),
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0,1)),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- An individual account. May or may not have a login, may or may not belong to a family.
CREATE TABLE IF NOT EXISTS persons (
  id SERIAL PRIMARY KEY,
  display_name TEXT NOT NULL,
  user_id INTEGER UNIQUE REFERENCES users(id),
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0,1))
);

CREATE TABLE IF NOT EXISTS family_memberships (
  id SERIAL PRIMARY KEY,
  family_id INTEGER NOT NULL REFERENCES families(id),
  person_id INTEGER NOT NULL REFERENCES persons(id),
  joined_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  left_at TIMESTAMP WITH TIME ZONE
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_membership_active ON family_memberships(person_id) WHERE left_at IS NULL;

CREATE TABLE IF NOT EXISTS trips (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  destination TEXT,
  start_date TEXT,
  end_date TEXT,
  description TEXT,
  notes TEXT,
  budget_paise BIGINT CHECK (budget_paise IS NULL OR budget_paise >= 0),
  status TEXT NOT NULL DEFAULT 'planning' CHECK (status IN ('planning','upcoming','ongoing','completed')),
  is_private INTEGER NOT NULL DEFAULT 0 CHECK (is_private IN (0,1)),
  created_by INTEGER NOT NULL REFERENCES users(id),
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS trip_families (
  trip_id INTEGER NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  family_id INTEGER NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  PRIMARY KEY (trip_id, family_id)
);

CREATE TABLE IF NOT EXISTS trip_participants (
  trip_id INTEGER NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  person_id INTEGER NOT NULL REFERENCES persons(id) ON DELETE CASCADE,
  attendance TEXT NOT NULL DEFAULT 'pending' CHECK (attendance IN ('pending','coming','not_coming')),
  responded_at TIMESTAMP WITH TIME ZONE,
  PRIMARY KEY (trip_id, person_id)
);

CREATE TABLE IF NOT EXISTS attendance_log (
  id SERIAL PRIMARY KEY,
  trip_id INTEGER NOT NULL,
  person_id INTEGER NOT NULL,
  old_value TEXT,
  new_value TEXT NOT NULL,
  changed_by INTEGER NOT NULL REFERENCES users(id),
  changed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- account_type/account_id identify who paid or who owes: a person OR a family, never both.
CREATE TABLE IF NOT EXISTS expenses (
  id SERIAL PRIMARY KEY,
  trip_id INTEGER NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  expense_date TEXT NOT NULL,
  category TEXT NOT NULL,
  currency TEXT NOT NULL DEFAULT 'INR',
  total_paise BIGINT NOT NULL CHECK (total_paise > 0),
  paid_by_type TEXT NOT NULL CHECK (paid_by_type IN ('person','family')),
  paid_by_id INTEGER NOT NULL,
  accounting_mode TEXT NOT NULL CHECK (accounting_mode IN ('individual','family','mixed')),
  split_method TEXT NOT NULL CHECK (split_method IN ('equal','per_head','family_wise','individual','individual_remainder','itemized','custom','percentage')),
  notes TEXT,
  receipt_total_paise BIGINT CHECK (receipt_total_paise IS NULL OR receipt_total_paise >= 0),
  created_by INTEGER NOT NULL REFERENCES users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  voided_at TIMESTAMP WITH TIME ZONE
);
CREATE INDEX IF NOT EXISTS ix_expenses_trip ON expenses(trip_id);

CREATE TABLE IF NOT EXISTS expense_items (
  id SERIAL PRIMARY KEY,
  expense_id INTEGER NOT NULL REFERENCES expenses(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  unit_price_paise BIGINT NOT NULL CHECK (unit_price_paise >= 0),
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  subtotal_paise BIGINT NOT NULL CHECK (subtotal_paise = unit_price_paise * quantity),
  notes TEXT
);

CREATE TABLE IF NOT EXISTS expense_charges (
  id SERIAL PRIMARY KEY,
  expense_id INTEGER NOT NULL REFERENCES expenses(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('tax','service','tip','discount','adjustment')),
  label TEXT,
  signed_amount_paise BIGINT NOT NULL
);

-- Final saved shares. Historical: never rewritten by attendance or membership changes.
CREATE TABLE IF NOT EXISTS expense_allocations (
  id SERIAL PRIMARY KEY,
  expense_id INTEGER NOT NULL REFERENCES expenses(id) ON DELETE CASCADE,
  account_type TEXT NOT NULL CHECK (account_type IN ('person','family')),
  account_id INTEGER NOT NULL,
  amount_paise BIGINT NOT NULL CHECK (amount_paise >= 0),
  UNIQUE (expense_id, account_type, account_id)
);

-- Informational breakdown of a family's share among its members (NOT additional debt).
CREATE TABLE IF NOT EXISTS family_share_breakdown (
  id SERIAL PRIMARY KEY,
  expense_id INTEGER NOT NULL REFERENCES expenses(id) ON DELETE CASCADE,
  family_id INTEGER NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  person_id INTEGER NOT NULL REFERENCES persons(id) ON DELETE CASCADE,
  amount_paise BIGINT NOT NULL CHECK (amount_paise >= 0)
);

CREATE TABLE IF NOT EXISTS repayments (
  id SERIAL PRIMARY KEY,
  trip_id INTEGER NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  from_type TEXT NOT NULL CHECK (from_type IN ('person','family')),
  from_id INTEGER NOT NULL,
  to_type TEXT NOT NULL CHECK (to_type IN ('person','family')),
  to_id INTEGER NOT NULL,
  amount_paise BIGINT NOT NULL CHECK (amount_paise > 0),
  paid_on TEXT NOT NULL,
  reference TEXT,
  note TEXT,
  idempotency_key TEXT UNIQUE,
  recorded_by INTEGER NOT NULL REFERENCES users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK (NOT (from_type = to_type AND from_id = to_id))
);
CREATE INDEX IF NOT EXISTS ix_repayments_trip ON repayments(trip_id);

CREATE TABLE IF NOT EXISTS debt_assumptions (
  id SERIAL PRIMARY KEY,
  trip_id INTEGER NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  debtor_type TEXT NOT NULL,
  debtor_id INTEGER NOT NULL,
  assumed_by_type TEXT NOT NULL,
  assumed_by_id INTEGER NOT NULL,
  amount_paise BIGINT NOT NULL CHECK (amount_paise > 0),
  recorded_by INTEGER NOT NULL REFERENCES users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS audit_log (
  id SERIAL PRIMARY KEY,
  actor_user_id INTEGER REFERENCES users(id),
  action TEXT NOT NULL,
  entity TEXT NOT NULL,
  entity_id INTEGER,
  before_json TEXT,
  after_json TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

