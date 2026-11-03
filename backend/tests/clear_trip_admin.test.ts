import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { runMigrations } from '../src/db/migrations';
import { createInitialSuperAdmin } from '../src/auth/setup';
import { hashPassword } from '../src/auth/password';
import { createSession } from '../src/auth/session';
import { createApp } from '../src/app';
import { setDb } from '../src/db/connection';
import { personKey, familyKey } from '../src/finance';

function setupClearTripTestEnv() {
  const db = new DatabaseSync(':memory:');
  db.exec('PRAGMA foreign_keys = ON;');
  runMigrations(db);
  setDb(db);

  // 1. Super Admin: Surya
  const { user: superAdmin, person: adminPerson } = createInitialSuperAdmin(
    db,
    'admin@tripmates.local',
    'Admin123!',
    'Surya Admin'
  );
  const superAdminSession = createSession(db, superAdmin.id);

  // 2. Regular User & Family Admin: Ramesh (Family 1)
  const user1Res = db.prepare(`
    INSERT INTO users (email, password_hash, role, is_active)
    VALUES ('ramesh@tripmates.local', ?, 'family_admin', 1)
  `).run(hashPassword('User123!'));
  const user1Id = Number(user1Res.lastInsertRowid);
  const person1Res = db.prepare(`
    INSERT INTO persons (display_name, user_id, is_active)
    VALUES ('Ramesh', ?, 1)
  `).run(user1Id);
  const person1Id = Number(person1Res.lastInsertRowid);
  const fam1Res = db.prepare(`
    INSERT INTO families (name, admin_user_id, is_active)
    VALUES ('Ramesh Family', ?, 1)
  `).run(user1Id);
  const fam1Id = Number(fam1Res.lastInsertRowid);
  db.prepare(`INSERT INTO family_memberships (family_id, person_id) VALUES (?, ?)`).run(fam1Id, person1Id);
  const rameshSession = createSession(db, user1Id);

  // 3. Regular Member: Suresh (Family 2)
  const user2Res = db.prepare(`
    INSERT INTO users (email, password_hash, role, is_active)
    VALUES ('suresh@tripmates.local', ?, 'member', 1)
  `).run(hashPassword('User123!'));
  const user2Id = Number(user2Res.lastInsertRowid);
  const person2Res = db.prepare(`
    INSERT INTO persons (display_name, user_id, is_active)
    VALUES ('Suresh', ?, 1)
  `).run(user2Id);
  const person2Id = Number(person2Res.lastInsertRowid);
  const fam2Res = db.prepare(`
    INSERT INTO families (name, admin_user_id, is_active)
    VALUES ('Suresh Family', ?, 1)
  `).run(user2Id);
  const fam2Id = Number(fam2Res.lastInsertRowid);
  db.prepare(`INSERT INTO family_memberships (family_id, person_id) VALUES (?, ?)`).run(fam2Id, person2Id);
  const sureshSession = createSession(db, user2Id);

  // 4. Trip 1: "Goa Beach Holiday" (TARGET TO CLEAR)
  const trip1Res = db.prepare(`
    INSERT INTO trips (name, destination, budget_paise, created_by)
    VALUES ('Goa Beach Holiday', 'Goa', 5000000, ?)
  `).run(user1Id);
  const trip1Id = Number(trip1Res.lastInsertRowid);

  // Add participants and families to Trip 1
  db.prepare(`INSERT INTO trip_families (trip_id, family_id) VALUES (?, ?)`).run(trip1Id, fam1Id);
  db.prepare(`INSERT INTO trip_families (trip_id, family_id) VALUES (?, ?)`).run(trip1Id, fam2Id);
  db.prepare(`INSERT INTO trip_participants (trip_id, person_id, attendance) VALUES (?, ?, 'coming')`).run(trip1Id, person1Id);
  db.prepare(`INSERT INTO trip_participants (trip_id, person_id, attendance) VALUES (?, ?, 'coming')`).run(trip1Id, person2Id);

  // Add visiting place to Trip 1
  db.prepare(`
    INSERT INTO trip_places (trip_id, name, latitude, longitude, order_index, created_by)
    VALUES (?, 'Baga Beach', 15.552, 73.751, 1, ?)
  `).run(trip1Id, user1Id);

  // Add expense to Trip 1
  const expRes = db.prepare(`
    INSERT INTO expenses (
      trip_id, title, expense_date, category, currency, total_paise,
      paid_by_type, paid_by_id, accounting_mode, split_method, created_by
    ) VALUES (?, 'Seafood Shack Dinner', '2026-11-03', 'Food', 'INR', 400000, 'person', ?, 'individual', 'equal', ?)
  `).run(trip1Id, person1Id, user1Id);
  const expId = Number(expRes.lastInsertRowid);

  // Add allocations to Trip 1's expense
  db.prepare(`
    INSERT INTO expense_allocations (expense_id, account_type, account_id, amount_paise)
    VALUES (?, 'person', ?, 200000)
  `).run(expId, person1Id);
  db.prepare(`
    INSERT INTO expense_allocations (expense_id, account_type, account_id, amount_paise)
    VALUES (?, 'person', ?, 200000)
  `).run(expId, person2Id);

  // Add repayment to Trip 1
  db.prepare(`
    INSERT INTO repayments (
      trip_id, from_type, from_id, to_type, to_id, amount_paise, paid_on, recorded_by
    ) VALUES (?, 'person', ?, 'person', ?, 200000, '2026-11-03', ?)
  `).run(trip1Id, person2Id, person1Id, user2Id);

  // Add notification for Trip 1
  db.prepare(`
    INSERT INTO notifications (user_id, trip_id, expense_id, type, title, message)
    VALUES (?, ?, ?, 'new_expense', 'Expense Added', 'Dinner bill added')
  `).run(user2Id, trip1Id, expId);

  // 5. Trip 2: "Kerala Backwaters" (UNRELATED TRIP THAT MUST REMAIN INTACT)
  const trip2Res = db.prepare(`
    INSERT INTO trips (name, destination, budget_paise, created_by)
    VALUES ('Kerala Backwaters', 'Alleppey', 8000000, ?)
  `).run(user2Id);
  const trip2Id = Number(trip2Res.lastInsertRowid);
  db.prepare(`INSERT INTO trip_families (trip_id, family_id) VALUES (?, ?)`).run(trip2Id, fam2Id);
  db.prepare(`INSERT INTO trip_participants (trip_id, person_id, attendance) VALUES (?, ?, 'coming')`).run(trip2Id, person2Id);
  const exp2Res = db.prepare(`
    INSERT INTO expenses (
      trip_id, title, expense_date, category, currency, total_paise,
      paid_by_type, paid_by_id, accounting_mode, split_method, created_by
    ) VALUES (?, 'Houseboat Rental', '2026-11-03', 'Stay', 'INR', 700000, 'person', ?, 'individual', 'equal', ?)
  `).run(trip2Id, person2Id, user2Id);
  const exp2Id = Number(exp2Res.lastInsertRowid);
  db.prepare(`
    INSERT INTO expense_allocations (expense_id, account_type, account_id, amount_paise)
    VALUES (?, 'person', ?, 700000)
  `).run(exp2Id, person2Id);

  const app = createApp();

  return {
    db,
    app,
    superAdmin,
    superAdminSession,
    rameshSession,
    sureshSession,
    user1Id,
    user2Id,
    person1Id,
    person2Id,
    fam1Id,
    fam2Id,
    trip1Id,
    trip2Id,
    expId,
    exp2Id,
  };
}

test('CLEAR TRIP: Ordinary members and Family Admins cannot access Clear Trip endpoint (403/401)', async () => {
  const env = setupClearTripTestEnv();
  const server = env.app.listen(0);
  const port = (server.address() as any).port;
  const baseUrl = `http://127.0.0.1:${port}`;

  try {
    // 1. Unauthenticated request rejected with 401
    const unauthRes = await fetch(`${baseUrl}/api/admin/trips/${env.trip1Id}`, {
      method: 'DELETE',
    });
    assert.equal(unauthRes.status, 401);

    // 2. Regular member (Suresh) rejected with 403
    const memberRes = await fetch(`${baseUrl}/api/admin/trips/${env.trip1Id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${env.sureshSession.token}` },
    });
    assert.equal(memberRes.status, 403);

    // 3. Family admin (Ramesh, who created Trip 1) rejected with 403 from admin endpoint
    const famAdminRes = await fetch(`${baseUrl}/api/admin/trips/${env.trip1Id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${env.rameshSession.token}` },
    });
    assert.equal(famAdminRes.status, 403);

    // 4. POST /clear alias also protected
    const aliasRes = await fetch(`${baseUrl}/api/admin/trips/${env.trip1Id}/clear`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${env.rameshSession.token}` },
    });
    assert.equal(aliasRes.status, 403);
  } finally {
    server.close();
  }
});

test('CLEAR TRIP: Super Admin permanently clears trip for ALL users; verifies cascade cleanup & audit log', async () => {
  const env = setupClearTripTestEnv();
  const server = env.app.listen(0);
  const port = (server.address() as any).port;
  const baseUrl = `http://127.0.0.1:${port}`;

  try {
    // Before deletion: verify Trip 1 is visible to Ramesh and Suresh
    const rameshTripsBefore = await fetch(`${baseUrl}/api/trips`, {
      headers: { Authorization: `Bearer ${env.rameshSession.token}` },
    }).then(r => r.json());
    assert.ok(rameshTripsBefore.some((t: any) => t.id === env.trip1Id));

    const sureshTripsBefore = await fetch(`${baseUrl}/api/trips`, {
      headers: { Authorization: `Bearer ${env.sureshSession.token}` },
    }).then(r => r.json());
    assert.ok(sureshTripsBefore.some((t: any) => t.id === env.trip1Id));

    // Execute Super Admin Clear Trip
    const clearRes = await fetch(`${baseUrl}/api/admin/trips/${env.trip1Id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${env.superAdminSession.token}` },
    });
    const clearData = await clearRes.json();
    if (clearRes.status !== 200) console.log('Clear Trip Error Response:', clearData);
    assert.equal(clearRes.status, 200);
    assert.equal(clearData.success, true);
    assert.equal(clearData.tripId, env.trip1Id);

    // 1. Verify trip is permanently gone from DB
    const tripRow = env.db.prepare('SELECT * FROM trips WHERE id = ?').get(env.trip1Id);
    assert.equal(tripRow, undefined);

    // 2. Verify all trip-associated child records are deleted
    assert.equal(env.db.prepare('SELECT count(*) as c FROM trip_participants WHERE trip_id = ?').get(env.trip1Id).c, 0);
    assert.equal(env.db.prepare('SELECT count(*) as c FROM trip_families WHERE trip_id = ?').get(env.trip1Id).c, 0);
    assert.equal(env.db.prepare('SELECT count(*) as c FROM expenses WHERE trip_id = ?').get(env.trip1Id).c, 0);
    assert.equal(env.db.prepare('SELECT count(*) as c FROM expense_allocations WHERE expense_id = ?').get(env.expId).c, 0);
    assert.equal(env.db.prepare('SELECT count(*) as c FROM repayments WHERE trip_id = ?').get(env.trip1Id).c, 0);
    assert.equal(env.db.prepare('SELECT count(*) as c FROM trip_places WHERE trip_id = ?').get(env.trip1Id).c, 0);
    assert.equal(env.db.prepare('SELECT count(*) as c FROM notifications WHERE trip_id = ?').get(env.trip1Id).c, 0);

    // 3. Verify Trip 1 no longer appears in ANY user's trip list or dashboard
    const rameshTripsAfter = await fetch(`${baseUrl}/api/trips`, {
      headers: { Authorization: `Bearer ${env.rameshSession.token}` },
    }).then(r => r.json());
    assert.ok(!rameshTripsAfter.some((t: any) => t.id === env.trip1Id));

    const sureshTripsAfter = await fetch(`${baseUrl}/api/trips`, {
      headers: { Authorization: `Bearer ${env.sureshSession.token}` },
    }).then(r => r.json());
    assert.ok(!sureshTripsAfter.some((t: any) => t.id === env.trip1Id));

    // Admin trips list also no longer contains Trip 1
    const adminTripsAfter = await fetch(`${baseUrl}/api/admin/trips`, {
      headers: { Authorization: `Bearer ${env.superAdminSession.token}` },
    }).then(r => r.json());
    assert.ok(!adminTripsAfter.some((t: any) => t.id === env.trip1Id));

    // Directly querying Trip 1 returns 404
    const notFoundRes = await fetch(`${baseUrl}/api/trips/${env.trip1Id}`, {
      headers: { Authorization: `Bearer ${env.rameshSession.token}` },
    });
    assert.equal(notFoundRes.status, 404);

    // 4. Verify unrelated Trip 2 is COMPLETELY UNAFFECTED
    const trip2Row = env.db.prepare('SELECT * FROM trips WHERE id = ?').get(env.trip2Id) as any;
    assert.ok(trip2Row);
    assert.equal(trip2Row.name, 'Kerala Backwaters');
    assert.equal(env.db.prepare('SELECT count(*) as c FROM expenses WHERE trip_id = ?').get(env.trip2Id).c, 1);
    assert.equal(env.db.prepare('SELECT count(*) as c FROM expense_allocations WHERE expense_id = ?').get(env.exp2Id).c, 1);

    // Suresh still sees Trip 2
    assert.ok(sureshTripsAfter.some((t: any) => t.id === env.trip2Id));

    // 5. Verify user accounts and family accounts are COMPLETELY INTACT
    const user1 = env.db.prepare('SELECT * FROM users WHERE id = ?').get(env.user1Id);
    assert.ok(user1);
    const user2 = env.db.prepare('SELECT * FROM users WHERE id = ?').get(env.user2Id);
    assert.ok(user2);
    const fam1 = env.db.prepare('SELECT * FROM families WHERE id = ?').get(env.fam1Id);
    assert.ok(fam1);
    const fam2 = env.db.prepare('SELECT * FROM families WHERE id = ?').get(env.fam2Id);
    assert.ok(fam2);

    // 6. Verify audit log entry
    const auditRow = env.db.prepare(`
      SELECT * FROM audit_log
      WHERE action = 'CLEAR_TRIP_FOR_ALL_USERS' AND entity_id = ?
    `).get(env.trip1Id) as any;
    assert.ok(auditRow);
    assert.equal(auditRow.actor_user_id, env.superAdmin.id);
    const beforeObj = JSON.parse(auditRow.before_json);
    assert.equal(beforeObj.name, 'Goa Beach Holiday');
    const afterObj = JSON.parse(auditRow.after_json);
    assert.equal(afterObj.deleted_by_admin, env.superAdmin.email);
    assert.ok(afterObj.deleted_at);
  } finally {
    server.close();
  }
});
