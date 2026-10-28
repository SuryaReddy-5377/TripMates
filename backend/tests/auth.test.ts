import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { runMigrations } from '../src/db/migrations';
import { hashPassword, verifyPassword } from '../src/auth/password';
import { hasSuperAdmin, createInitialSuperAdmin } from '../src/auth/setup';
import { createSession, validateSession, revokeSession } from '../src/auth/session';

function setupTestDb() {
  const db = new DatabaseSync(':memory:');
  db.exec('PRAGMA foreign_keys = ON;');
  runMigrations(db);
  return db;
}

test('auth: password hashing and verification', () => {
  const hash = hashPassword('SecretPass123');
  assert.ok(hash.startsWith('scrypt$'), 'Hash should use scrypt');
  assert.equal(verifyPassword('SecretPass123', hash), true);
  assert.equal(verifyPassword('WrongPass', hash), false);
  assert.equal(verifyPassword('', hash), false);
  assert.throws(() => hashPassword('123'), /at least 6 characters/);
});

test('auth: first super-admin setup is allowed once and rejects duplicates', () => {
  const db = setupTestDb();
  assert.equal(hasSuperAdmin(db), false);

  const { user, person } = createInitialSuperAdmin(db, 'admin@tripmates.local', 'AdminSecure123', 'Super Admin');
  assert.equal(user.role, 'super_admin');
  assert.equal(user.email, 'admin@tripmates.local');
  assert.equal(person.display_name, 'Super Admin');
  assert.equal(hasSuperAdmin(db), true);

  // Attempt second super admin setup should throw
  assert.throws(() => {
    createInitialSuperAdmin(db, 'another@tripmates.local', 'Pass12345', 'Admin Two');
  }, /already configured/);
});

test('auth: session creation, validation, and revocation', () => {
  const db = setupTestDb();
  const { user } = createInitialSuperAdmin(db, 'admin@tripmates.local', 'AdminSecure123', 'Super Admin');

  const session = createSession(db, user.id, 7);
  assert.ok(session.token.length >= 32);

  const validated = validateSession(db, session.token);
  assert.ok(validated);
  assert.equal(validated.user.id, user.id);
  assert.equal(validated.user.role, 'super_admin');
  assert.equal(validated.person?.display_name, 'Super Admin');

  revokeSession(db, session.token);
  assert.equal(validateSession(db, session.token), null);
});
