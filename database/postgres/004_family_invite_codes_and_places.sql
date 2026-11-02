-- Migration 004 (PostgreSQL): Family Invite Codes and Trip Visiting Places
CREATE EXTENSION IF NOT EXISTS citext;

CREATE TABLE IF NOT EXISTS family_invite_codes (
  id SERIAL PRIMARY KEY,
  code CITEXT NOT NULL UNIQUE,
  family_id INTEGER REFERENCES families(id) ON DELETE SET NULL,
  max_uses INTEGER NOT NULL DEFAULT 1 CHECK (max_uses >= 1),
  uses_count INTEGER NOT NULL DEFAULT 0 CHECK (uses_count >= 0),
  expires_at TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'revoked', 'exhausted')),
  created_by INTEGER NOT NULL REFERENCES users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  notes TEXT
);

CREATE INDEX IF NOT EXISTS ix_family_invite_codes_code ON family_invite_codes(code);
CREATE INDEX IF NOT EXISTS ix_family_invite_codes_family ON family_invite_codes(family_id);
CREATE INDEX IF NOT EXISTS ix_family_invite_codes_status ON family_invite_codes(status);

CREATE TABLE IF NOT EXISTS trip_places (
  id SERIAL PRIMARY KEY,
  trip_id INTEGER NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  order_index INTEGER NOT NULL DEFAULT 0,
  notes TEXT,
  planned_date TEXT,
  created_by INTEGER NOT NULL REFERENCES users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS ix_trip_places_trip_order ON trip_places(trip_id, order_index);

