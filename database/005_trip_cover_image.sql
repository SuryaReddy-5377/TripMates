-- Migration 005: Add cover_image to trips
ALTER TABLE trips ADD COLUMN cover_image TEXT;

