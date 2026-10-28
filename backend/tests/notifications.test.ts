import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { runMigrations } from '../src/db/migrations';
import { createInitialSuperAdmin } from '../src/auth/setup';
import { createSession } from '../src/auth/session';
import { hashPassword } from '../src/auth/password';
import { createApp } from '../src/app';
import { setDb } from '../src/db/connection';
import { personKey } from '../src/finance';

function setupNotificationTestEnv() {
  const db = new DatabaseSync(':memory:');
  db.exec('PRAGMA foreign_keys = ON;');
  runMigrations(db);
  setDb(db);

  // Super Admin (Surya)
  const { user: superAdmin, person: superPerson } = createInitialSuperAdmin(db, 'surya@tripmates.local', 'SuperAdmin123!', 'Surya Admin');
  const superSession = createSession(db, superAdmin.id);

  // User 1: Member Alice
  const pwdAlice = hashPassword('AlicePass123!');
  const userAliceRes = db.prepare(`INSERT INTO users (email, password_hash, role) VALUES ('alice@family.com', ?, 'member')`).run(pwdAlice);
  const aliceUserId = Number(userAliceRes.lastInsertRowid);
  const personAliceRes = db.prepare(`INSERT INTO persons (display_name, user_id) VALUES ('Alice', ?)`).run(aliceUserId);
  const alicePersonId = Number(personAliceRes.lastInsertRowid);
  const aliceSession = createSession(db, aliceUserId);

  // User 2: Member Bob
  const pwdBob = hashPassword('BobPass123!');
  const userBobRes = db.prepare(`INSERT INTO users (email, password_hash, role) VALUES ('bob@family.com', ?, 'member')`).run(pwdBob);
  const bobUserId = Number(userBobRes.lastInsertRowid);
  const personBobRes = db.prepare(`INSERT INTO persons (display_name, user_id) VALUES ('Bob', ?)`).run(bobUserId);
  const bobPersonId = Number(personBobRes.lastInsertRowid);
  const bobSession = createSession(db, bobUserId);

  // User 3: Unrelated User Charlie (belongs to another family / no trip membership)
  const pwdCharlie = hashPassword('CharliePass123!');
  const userCharlieRes = db.prepare(`INSERT INTO users (email, password_hash, role) VALUES ('charlie@other.com', ?, 'member')`).run(pwdCharlie);
  const charlieUserId = Number(userCharlieRes.lastInsertRowid);
  const personCharlieRes = db.prepare(`INSERT INTO persons (display_name, user_id) VALUES ('Charlie', ?)`).run(charlieUserId);
  const charliePersonId = Number(personCharlieRes.lastInsertRowid);
  const charlieSession = createSession(db, charlieUserId);

  // Family Alpha
  const famRes = db.prepare(`INSERT INTO families (name, admin_user_id) VALUES ('Alpha Family', ?)`).run(aliceUserId);
  const famId = Number(famRes.lastInsertRowid);
  db.prepare(`INSERT INTO family_memberships (family_id, person_id) VALUES (?, ?)`).run(famId, alicePersonId);
  db.prepare(`INSERT INTO family_memberships (family_id, person_id) VALUES (?, ?)`).run(famId, bobPersonId);

  // Trip created by Alice: Tirupati Family Trip
  const tripRes = db.prepare(`
    INSERT INTO trips (name, destination, start_date, end_date, created_by)
    VALUES ('Tirupati Family Trip', 'Tirupati', '2026-11-10', '2026-11-13', ?)
  `).run(aliceUserId);
  const tripId = Number(tripRes.lastInsertRowid);

  // Add Alice to trip
  db.prepare(`INSERT INTO trip_participants (trip_id, person_id, attendance) VALUES (?, ?, 'coming')`).run(tripId, alicePersonId);

  const app = createApp();

  return {
    db,
    app,
    superAdmin,
    superSession,
    aliceUserId,
    alicePersonId,
    aliceSession,
    bobUserId,
    bobPersonId,
    bobSession,
    charlieUserId,
    charliePersonId,
    charlieSession,
    famId,
    tripId,
  };
}

test('1 & 2: Adding a participant creates the correct trip notification and unrelated users receive no notification', async () => {
  const env = setupNotificationTestEnv();
  const server = env.app.listen(0);
  const port = (server.address() as any).port;
  const baseUrl = `http://127.0.0.1:${port}`;

  try {
    // Alice adds Bob to the trip
    const addRes = await fetch(`${baseUrl}/api/trips/${env.tripId}/participants`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${env.aliceSession.token}`,
      },
      body: JSON.stringify({ person_id: env.bobPersonId }),
    });
    assert.equal(addRes.status, 200);

    // 1. Check Bob's notifications: must have received 1 notification
    const bobNotifRes = await fetch(`${baseUrl}/api/notifications`, {
      headers: { Authorization: `Bearer ${env.bobSession.token}` },
    });
    assert.equal(bobNotifRes.status, 200);
    const bobNotifs = await bobNotifRes.json();
    assert.equal(bobNotifs.unread_count, 1);
    assert.equal(bobNotifs.notifications.length, 1);
    const notif = bobNotifs.notifications[0];
    assert.equal(notif.type, 'trip_added');
    assert.ok(notif.title.includes('Tirupati Family Trip'));
    assert.ok(notif.message.includes('Alice added you to "Tirupati Family Trip"'));
    assert.equal(notif.trip_id, env.tripId);
    assert.equal(notif.is_read, 0);

    // 2. Check Charlie's notifications (unrelated user): MUST BE 0!
    const charlieNotifRes = await fetch(`${baseUrl}/api/notifications`, {
      headers: { Authorization: `Bearer ${env.charlieSession.token}` },
    });
    assert.equal(charlieNotifRes.status, 200);
    const charlieNotifs = await charlieNotifRes.json();
    assert.equal(charlieNotifs.unread_count, 0);
    assert.equal(charlieNotifs.notifications.length, 0);

    // 6. Test duplicate prevention: Adding Bob again must not generate duplicate notification
    const duplicateAddRes = await fetch(`${baseUrl}/api/trips/${env.tripId}/participants`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${env.aliceSession.token}`,
      },
      body: JSON.stringify({ person_id: env.bobPersonId }),
    });
    assert.equal(duplicateAddRes.status, 200);

    const bobNotifsAfter = await (await fetch(`${baseUrl}/api/notifications`, {
      headers: { Authorization: `Bearer ${env.bobSession.token}` },
    })).json();
    assert.equal(bobNotifsAfter.notifications.length, 1, 'Duplicate participant add must NOT create duplicate notification');
  } finally {
    server.close();
  }
});

test('3, 4 & 5: Adding an expense notifies authorized recipients; selected participants get their share; unselected participants are not shown as owing', async () => {
  const env = setupNotificationTestEnv();
  // Add Bob to trip
  env.db.prepare(`INSERT INTO trip_participants (trip_id, person_id, attendance) VALUES (?, ?, 'coming')`).run(env.tripId, env.bobPersonId);

  // Add a 3rd member 'Daisy' with a user account to the trip
  const pwdDaisy = hashPassword('DaisyPass123!');
  const userDaisyRes = env.db.prepare(`INSERT INTO users (email, password_hash, role) VALUES ('daisy@family.com', ?, 'member')`).run(pwdDaisy);
  const daisyUserId = Number(userDaisyRes.lastInsertRowid);
  const personDaisyRes = env.db.prepare(`INSERT INTO persons (display_name, user_id) VALUES ('Daisy', ?)`).run(daisyUserId);
  const daisyPersonId = Number(personDaisyRes.lastInsertRowid);
  const daisySession = createSession(env.db, daisyUserId);
  env.db.prepare(`INSERT INTO trip_participants (trip_id, person_id, attendance) VALUES (?, ?, 'coming')`).run(env.tripId, daisyPersonId);

  const server = env.app.listen(0);
  const port = (server.address() as any).port;
  const baseUrl = `http://127.0.0.1:${port}`;

  try {
    // Alice records an itemized expense:
    // Total ₹470:
    // Alice + Bob eat breakfast (shared ₹470 equally: ₹235 each)
    // Daisy is in the trip but did NOT eat breakfast (₹0 share)
    const expensePayload = {
      title: 'South Indian Breakfast',
      expense_date: '2026-11-10',
      category: 'Food',
      paid_by_type: 'person',
      paid_by_id: env.alicePersonId,
      accounting_mode: 'individual',
      split_method: 'equal',
      total_rupees: 470,
      participant_keys: [personKey(env.alicePersonId), personKey(env.bobPersonId)],
    };

    const expRes = await fetch(`${baseUrl}/api/trips/${env.tripId}/expenses`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${env.aliceSession.token}`,
      },
      body: JSON.stringify(expensePayload),
    });
    assert.equal(expRes.status, 201);

    // 4. Check Bob's notification: Selected participant must receive their share (₹235)
    const bobNotifs = await (await fetch(`${baseUrl}/api/notifications`, {
      headers: { Authorization: `Bearer ${env.bobSession.token}` },
    })).json();

    const bobExpNotif = bobNotifs.notifications.find((n: any) => n.type === 'new_expense');
    assert.ok(bobExpNotif, 'Bob must have an expense notification');
    assert.ok(bobExpNotif.message.includes('Your share: ₹235'), 'Bob must see his assigned share of ₹235');
    assert.equal(bobExpNotif.data.share_paise, 23500);
    assert.equal(bobExpNotif.data.is_assigned, true);

    // 5. Check Daisy's notification: Unselected participant must NOT be shown as owing money!
    const daisyNotifs = await (await fetch(`${baseUrl}/api/notifications`, {
      headers: { Authorization: `Bearer ${daisySession.token}` },
    })).json();

    const daisyExpNotif = daisyNotifs.notifications.find((n: any) => n.type === 'new_expense');
    assert.ok(daisyExpNotif, 'Daisy receives expense notification as trip participant');
    assert.ok(daisyExpNotif.message.includes('₹0 share'), 'Daisy must be explicitly shown ₹0 share');
    assert.equal(daisyExpNotif.data.is_assigned, false);
    assert.equal(daisyExpNotif.data.share_paise, 0);

    // Check Charlie (unrelated user outside trip): receives ZERO notifications
    const charlieNotifs = await (await fetch(`${baseUrl}/api/notifications`, {
      headers: { Authorization: `Bearer ${env.charlieSession.token}` },
    })).json();
    assert.equal(charlieNotifs.notifications.length, 0, 'Unrelated user must receive no notification');
  } finally {
    server.close();
  }
});

test('7 & 8: Notifications persist after re-login and users cannot read or modify another users notifications', async () => {
  const env = setupNotificationTestEnv();
  // Create notification for Bob
  env.db.prepare(`
    INSERT INTO notifications (user_id, type, title, message, trip_id)
    VALUES (?, 'trip_invitation', 'Test Notification', 'Welcome to TripMates', ?)
  `).run(env.bobUserId, env.tripId);
  const bobNotifId = (env.db.prepare('SELECT last_insert_rowid() as id').get() as any).id;

  const server = env.app.listen(0);
  const port = (server.address() as any).port;
  const baseUrl = `http://127.0.0.1:${port}`;

  try {
    // 7. Verify notification persists after creating a new session (re-login)
    const newBobSession = createSession(env.db, env.bobUserId);
    const fetchRes = await fetch(`${baseUrl}/api/notifications`, {
      headers: { Authorization: `Bearer ${newBobSession.token}` },
    });
    assert.equal(fetchRes.status, 200);
    const data = await fetchRes.json();
    assert.equal(data.notifications.length, 1);
    assert.equal(data.notifications[0].title, 'Test Notification');

    // 8. Security: Alice tries to mark Bob's notification as read -> Must return 403 Forbidden!
    const tamperRes = await fetch(`${baseUrl}/api/notifications/${bobNotifId}/read`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${env.aliceSession.token}` },
    });
    assert.equal(tamperRes.status, 403, 'Users cannot modify another user notifications');

    // Bob marks his own notification as read -> Must return 200 OK
    const legitRes = await fetch(`${baseUrl}/api/notifications/${bobNotifId}/read`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${env.bobSession.token}` },
    });
    assert.equal(legitRes.status, 200);

    // Verify status is now read
    const verifyRes = await fetch(`${baseUrl}/api/notifications`, {
      headers: { Authorization: `Bearer ${env.bobSession.token}` },
    });
    const verifyData = await verifyRes.json();
    assert.equal(verifyData.unread_count, 0);
    assert.equal(verifyData.notifications[0].is_read, 1);
  } finally {
    server.close();
  }
});
