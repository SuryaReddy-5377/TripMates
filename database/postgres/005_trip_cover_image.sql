-- Migration 005 (PostgreSQL): Trip Cover Image
ALTER TABLE trips ADD COLUMN IF NOT EXISTS cover_image TEXT;

