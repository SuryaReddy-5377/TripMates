-- Migration 003: Notifications, User Preferences, and Security Audit Extensions
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS notifications (
  id INTEGER PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  type TEXT NOT NULL CHECK (type IN ('trip_invitation', 'trip_added', 'trip_update', 'new_expense', 'expense_update', 'repayment', 'system')),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  trip_id INTEGER REFERENCES trips(id),
  expense_id INTEGER REFERENCES expenses(id),
  repayment_id INTEGER REFERENCES repayments(id),
  data_json TEXT,
  is_read INTEGER NOT NULL DEFAULT 0 CHECK (is_read IN (0, 1)),
  read_at TEXT,
  event_key TEXT UNIQUE,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS ix_notifications_user_unread ON notifications(user_id, is_read, created_at);
CREATE INDEX IF NOT EXISTS ix_notifications_trip ON notifications(trip_id);
CREATE INDEX IF NOT EXISTS ix_notifications_event_key ON notifications(event_key);

CREATE TABLE IF NOT EXISTS notification_preferences (
  user_id INTEGER PRIMARY KEY REFERENCES users(id),
  trip_notifications INTEGER NOT NULL DEFAULT 1 CHECK (trip_notifications IN (0, 1)),
  expense_notifications INTEGER NOT NULL DEFAULT 1 CHECK (expense_notifications IN (0, 1)),
  repayment_notifications INTEGER NOT NULL DEFAULT 1 CHECK (repayment_notifications IN (0, 1)),
  browser_push_enabled INTEGER NOT NULL DEFAULT 0 CHECK (browser_push_enabled IN (0, 1)),
  push_subscription_json TEXT,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS ix_audit_actor ON audit_log(actor_user_id);
CREATE INDEX IF NOT EXISTS ix_audit_entity ON audit_log(entity, entity_id);
CREATE INDEX IF NOT EXISTS ix_audit_created ON audit_log(created_at);
