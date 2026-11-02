-- Migration 006 (PostgreSQL): Feedback and Feature Suggestions

CREATE TABLE IF NOT EXISTS suggestions (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  person_id INTEGER REFERENCES persons(id) ON DELETE SET NULL,
  category TEXT NOT NULL CHECK (category IN ('feature', 'improvement', 'feedback', 'bug', 'other')),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'reviewed', 'planned', 'resolved', 'dismissed')),
  admin_notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS ix_suggestions_user ON suggestions(user_id);
CREATE INDEX IF NOT EXISTS ix_suggestions_status ON suggestions(status);

