import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { runMigrations } from '../src/db/migrations';
import { createInitialSuperAdmin } from '../src/auth/setup';
import { createSession } from '../src/auth/session';
import { hashPassword } from '../src/auth/password';
import { createApp } from '../src/app';
import { setDb } from '../src/db/connection';

function setupEnvironment() {
  const db = new DatabaseSync(':memory:');
  db.exec('PRAGMA foreign_keys = ON;');
  runMigrations(db);
  setDb(db);

  // Setup Super Admin
  const { user: superAdmin } = createInitialSuperAdmin(db, 'super@tripmates.local', 'SuperAdmin123', 'Super Admin');
  const superSession = createSession(db, superAdmin.id);

  // Setup Family A and Family Admin A
  const pwdA = hashPassword('AdminPassA123');
  const userARes = db.prepare(`INSERT INTO users (email, password_hash, role) VALUES ('admin_a@family.com', ?, 'family_admin')`).run(pwdA);
  const userAId = Number(userARes.lastInsertRowid);
  const personARes = db.prepare(`INSERT INTO persons (display_name, user_id) VALUES ('Alice Admin', ?)`).run(userAId);
  const personAId = Number(personARes.lastInsertRowid);
  const famARes = db.prepare(`INSERT INTO families (name, admin_user_id) VALUES ('Alpha Family', ?)`).run(userAId);
  const famAId = Number(famARes.lastInsertRowid);
  db.prepare(`INSERT INTO family_memberships (family_id, person_id) VALUES (?, ?)`).run(famAId, personAId);
  const sessionA = createSession(db, userAId);

  // Setup Family B and Family Admin B
  const pwdB = hashPassword('AdminPassB123');
  const userBRes = db.prepare(`INSERT INTO users (email, password_hash, role) VALUES ('admin_b@family.com', ?, 'family_admin')`).run(pwdB);
  const userBId = Number(userBRes.lastInsertRowid);
  const personBRes = db.prepare(`INSERT INTO persons (display_name, user_id) VALUES ('Bob Admin', ?)`).run(userBId);
  const personBId = Number(personBRes.lastInsertRowid);
  const famBRes = db.prepare(`INSERT INTO families (name, admin_user_id) VALUES ('Beta Family', ?)`).run(userBId);
  const famBId = Number(famBRes.lastInsertRowid);
  db.prepare(`INSERT INTO family_memberships (family_id, person_id) VALUES (?, ?)`).run(famBId, personBId);
  const sessionB = createSession(db, userBId);

  const app = createApp();

  return {
    db,
    app,
    superAdmin,
    superSession,
    userAId,
    personAId,
    famAId,
    sessionA,
    userBId,
    personBId,
    famBId,
    sessionB,
  };
}

test('authorization: family data isolation - users cannot access other families', async () => {
  const env = setupEnvironment();
  const server = env.app.listen(0);
  const port = (server.address() as any).port;
  const baseUrl = `http://127.0.0.1:${port}`;

  try {
    // 1. Admin A listing families should only see Alpha Family (not Beta Family)
    const resA = await fetch(`${baseUrl}/api/families`, {
      headers: { Authorization: `Bearer ${env.sessionA.token}` },
    });
    const familiesA = await resA.json();
    assert.equal(resA.status, 200);
    assert.equal(familiesA.length, 1);
    assert.equal(familiesA[0].id, env.famAId);
    assert.equal(familiesA[0].name, 'Alpha Family');

    // 2. Admin A trying to directly fetch Family B details should be rejected with 403 Forbidden
    const resForbidden = await fetch(`${baseUrl}/api/families/${env.famBId}`, {
      headers: { Authorization: `Bearer ${env.sessionA.token}` },
    });
    assert.equal(resForbidden.status, 403);
    const forbiddenJson = await resForbidden.json();
    assert.equal(forbiddenJson.error, 'FORBIDDEN');

    // 3. Super Admin can view all families and inspect Family B
    const resSuper = await fetch(`${baseUrl}/api/families/${env.famBId}`, {
      headers: { Authorization: `Bearer ${env.superSession.token}` },
    });
    assert.equal(resSuper.status, 200);
    const famBJson = await resSuper.json();
    assert.equal(famBJson.id, env.famBId);
    assert.equal(famBJson.name, 'Beta Family');
  } finally {
    server.close();
  }
});

test('authorization: private completed trip access restriction', async () => {
  const env = setupEnvironment();
  const server = env.app.listen(0);
  const port = (server.address() as any).port;
  const baseUrl = `http://127.0.0.1:${port}`;

  try {
    // Create a private completed trip created by Super Admin
    // Alpha Family is in the trip. Person A attends ('coming').
    // Beta Family is in the trip. Person B does not attend ('not_coming').
    const tripRes = env.db.prepare(`
      INSERT INTO trips (name, destination, status, is_private, created_by, completed_at)
      VALUES ('Secret Mountain Retreat', 'Ooty', 'completed', 1, ?, datetime('now'))
    `).run(env.superAdmin.id);
    const tripId = Number(tripRes.lastInsertRowid);

    // Alpha Family in trip, Alice attended
    env.db.prepare(`INSERT INTO trip_families (trip_id, family_id) VALUES (?, ?)`).run(tripId, env.famAId);
    env.db.prepare(`INSERT INTO trip_participants (trip_id, person_id, attendance) VALUES (?, ?, 'coming')`).run(tripId, env.personAId);

    // Beta Family in trip, Bob declined ('not_coming')
    env.db.prepare(`INSERT INTO trip_families (trip_id, family_id) VALUES (?, ?)`).run(tripId, env.famBId);
    env.db.prepare(`INSERT INTO trip_participants (trip_id, person_id, attendance) VALUES (?, ?, 'not_coming')`).run(tripId, env.personBId);

    // 1. Confirmed attendee (Alice) can access the private completed trip
    const resAlice = await fetch(`${baseUrl}/api/trips/${tripId}`, {
      headers: { Authorization: `Bearer ${env.sessionA.token}` },
    });
    assert.equal(resAlice.status, 200);
    const tripAlice = await resAlice.json();
    assert.equal(tripAlice.name, 'Secret Mountain Retreat');

    // 2. Non-attendee (Bob, whose attendance was 'not_coming') must be BLOCKED
    const resBob = await fetch(`${baseUrl}/api/trips/${tripId}`, {
      headers: { Authorization: `Bearer ${env.sessionB.token}` },
    });
    assert.equal(resBob.status, 403);
    const bobJson = await resBob.json();
    assert.equal(bobJson.error, 'RESTRICTED_COMPLETED_TRIP');

    // 3. In the trip list, Bob does not see the private completed trip
    const resBobList = await fetch(`${baseUrl}/api/trips`, {
      headers: { Authorization: `Bearer ${env.sessionB.token}` },
    });
    const bobTrips = await resBobList.json();
    assert.equal(bobTrips.some((t: any) => t.id === tripId), false);
  } finally {
    server.close();
  }
});
