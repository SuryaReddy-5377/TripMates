-- Migration 004: Family Invite Codes and Trip Visiting Places
PRAGMA foreign_keys = ON;

-- Family Invite Codes for Super Admin management and registration
CREATE TABLE IF NOT EXISTS family_invite_codes (
  id INTEGER PRIMARY KEY,
  code TEXT NOT NULL UNIQUE COLLATE NOCASE,
  family_id INTEGER REFERENCES families(id), -- If NULL, allows creating/joining a new family upon registration
  max_uses INTEGER NOT NULL DEFAULT 1 CHECK (max_uses >= 1),
  uses_count INTEGER NOT NULL DEFAULT 0 CHECK (uses_count >= 0),
  expires_at TEXT, -- ISO string or NULL for no expiry
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'revoked', 'exhausted')),
  created_by INTEGER NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  notes TEXT
);

CREATE INDEX IF NOT EXISTS ix_family_invite_codes_code ON family_invite_codes(code);
CREATE INDEX IF NOT EXISTS ix_family_invite_codes_family ON family_invite_codes(family_id);
CREATE INDEX IF NOT EXISTS ix_family_invite_codes_status ON family_invite_codes(status);

-- Trip Visiting Places & Route Order for itinerary and interactive map
CREATE TABLE IF NOT EXISTS trip_places (
  id INTEGER PRIMARY KEY,
  trip_id INTEGER NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  latitude REAL NOT NULL,
  longitude REAL NOT NULL,
  order_index INTEGER NOT NULL DEFAULT 0,
  notes TEXT,
  planned_date TEXT,
  created_by INTEGER NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS ix_trip_places_trip_order ON trip_places(trip_id, order_index);
