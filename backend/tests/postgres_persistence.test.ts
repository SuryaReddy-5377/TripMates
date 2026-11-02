import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { translateToPg, withTransaction, getDb, AnyDb } from '../src/db/connection';
import { runMigrations } from '../src/db/migrations';
import { DatabaseSync } from 'node:sqlite';

test('PostgreSQL Persistence: SQL translator converts SQLite dialect to PostgreSQL', () => {
  // 1. COLLATE NOCASE removed
  const q1 = translateToPg('SELECT * FROM users WHERE email = ? COLLATE NOCASE');
  assert.equal(q1.sql, 'SELECT * FROM users WHERE email = $1');

  // 2. datetime('now') -> CURRENT_TIMESTAMP
  const q2 = translateToPg("UPDATE users SET updated_at = datetime('now') WHERE id = ?");
  assert.equal(q2.sql, 'UPDATE users SET updated_at = CURRENT_TIMESTAMP WHERE id = $1');

  // 3. INSERT INTO auto-appends RETURNING id
  const q3 = translateToPg('INSERT INTO trips (name, budget_paise) VALUES (?, ?)');
  assert.ok(q3.sql.endsWith('RETURNING id'), 'Should append RETURNING id');
  assert.ok(q3.sql.includes('VALUES ($1, $2)'), 'Should replace ? with $1, $2');

  // 4. INSERT OR IGNORE INTO -> ON CONFLICT DO NOTHING (respecting table schema for RETURNING id)
  const q4 = translateToPg('INSERT OR IGNORE INTO trip_participants (trip_id, person_id) VALUES (?, ?)');
  assert.ok(!q4.sql.includes('OR IGNORE'), 'OR IGNORE must be replaced');
  assert.ok(q4.sql.includes('ON CONFLICT DO NOTHING'), 'Must add ON CONFLICT DO NOTHING');
  assert.ok(!q4.sql.includes('RETURNING id'), 'trip_participants has no id column, must not append RETURNING id');
  assert.ok(q4.sql.includes('VALUES ($1, $2)'));

  const q4b = translateToPg('INSERT OR IGNORE INTO trip_families (trip_id, family_id) VALUES (?, ?)');
  assert.ok(!q4b.sql.includes('RETURNING id'), 'trip_families has no id column, must not append RETURNING id');

  const q4c = translateToPg('INSERT OR IGNORE INTO family_invite_codes (code, family_id) VALUES (?, ?)');
  assert.ok(q4c.sql.includes('ON CONFLICT DO NOTHING RETURNING id'), 'Tables with id column must append RETURNING id');

  // Verify suggestions query translation preserves sender_name and sender_email
  const qSug = translateToPg('INSERT INTO suggestions (user_id, person_id, sender_name, sender_email, title, message, category, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
  assert.ok(qSug.sql.includes('RETURNING id'), 'suggestions has id column and must append RETURNING id');
  assert.ok(qSug.sql.includes('$1, $2, $3, $4, $5, $6, $7, $8'), 'Must map 8 placeholders');

  // 5. Parameter indexing with multiple placeholders
  const q5 = translateToPg('SELECT id FROM family_memberships WHERE family_id = ? AND person_id = ? AND left_at IS NULL');
  assert.equal(q5.sql, 'SELECT id FROM family_memberships WHERE family_id = $1 AND person_id = $2 AND left_at IS NULL');
});

test('PostgreSQL Persistence: All 6 PostgreSQL migrations exist and contain valid definitions', () => {
  const pgDir = path.resolve(process.cwd(), 'database', 'postgres');
  assert.ok(fs.existsSync(pgDir), 'database/postgres directory must exist');

  const files = fs.readdirSync(pgDir).filter(f => f.endsWith('.sql')).sort();
  assert.equal(files.length, 6, 'Must have exactly 6 PostgreSQL migration files');

  const expectedFiles = [
    '001_initial_schema.sql',
    '002_sessions_and_invites.sql',
    '003_notifications_and_preferences.sql',
    '004_family_invite_codes_and_places.sql',
    '005_trip_cover_image.sql',
    '006_suggestions.sql',
  ];
  assert.deepEqual(files, expectedFiles);

  for (const f of files) {
    const content = fs.readFileSync(path.join(pgDir, f), 'utf8');
    assert.ok(content.length > 20, `${f} must not be empty`);
    assert.ok(!content.includes('COLLATE NOCASE'), `${f} must not contain SQLite-specific COLLATE NOCASE`);
  }
});

test('PostgreSQL Persistence: Adapter unified interface handles sync & async transactions cleanly', async () => {
  const rawDb = new DatabaseSync(':memory:');
  rawDb.exec('PRAGMA foreign_keys = ON;');
  runMigrations(rawDb);

  const db = getDb(); // Gets configured adapter
  assert.ok(db.prepare, 'Adapter must provide prepare method');
  assert.ok(db.exec, 'Adapter must provide exec method');

  // Test transaction helper with synchronous callback
  const syncRes = withTransaction(rawDb, () => {
    return 'sync-success';
  });
  assert.equal(syncRes, 'sync-success');

  // Test transaction helper with async callback
  const asyncRes = await withTransaction(rawDb, async () => {
    return 'async-success';
  });
  assert.equal(asyncRes, 'async-success');
});

