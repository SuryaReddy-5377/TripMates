import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { runMigrations } from '../src/db/migrations';
import { createInitialSuperAdmin } from '../src/auth/setup';
import { createSession } from '../src/auth/session';
import { hashPassword } from '../src/auth/password';
import { createApp } from '../src/app';
import { setDb } from '../src/db/connection';

function setupAdminTestEnv() {
  const db = new DatabaseSync(':memory:');
  db.exec('PRAGMA foreign_keys = ON;');
  runMigrations(db);
  setDb(db);

  // Super Admin
  const { user: superAdmin } = createInitialSuperAdmin(db, 'super@tripmates.local', 'SuperSecretPass123!', 'Super Admin');
  const superSession = createSession(db, superAdmin.id);

  // Family Admin for Family A
  const pwdFamAdmin = hashPassword('FamAdminPass123!');
  const famAdminRes = db.prepare(`INSERT INTO users (email, password_hash, role) VALUES ('fam_admin@alpha.com', ?, 'family_admin')`).run(pwdFamAdmin);
  const famAdminUserId = Number(famAdminRes.lastInsertRowid);
  const famAdminPersonRes = db.prepare(`INSERT INTO persons (display_name, user_id) VALUES ('Alice Admin', ?)`).run(famAdminUserId);
  const famAdminPersonId = Number(famAdminPersonRes.lastInsertRowid);
  const famARes = db.prepare(`INSERT INTO families (name, admin_user_id) VALUES ('Family Alpha', ?)`).run(famAdminUserId);
  const famAId = Number(famARes.lastInsertRowid);
  db.prepare(`INSERT INTO family_memberships (family_id, person_id) VALUES (?, ?)`).run(famAId, famAdminPersonId);
  const famAdminSession = createSession(db, famAdminUserId);

  // Regular Member for Family A
  const pwdMember = hashPassword('MemberPass123!');
  const memberRes = db.prepare(`INSERT INTO users (email, password_hash, role) VALUES ('member@alpha.com', ?, 'member')`).run(pwdMember);
  const memberUserId = Number(memberRes.lastInsertRowid);
  const memberPersonRes = db.prepare(`INSERT INTO persons (display_name, user_id) VALUES ('Bob Member', ?)`).run(memberUserId);
  const memberPersonId = Number(memberPersonRes.lastInsertRowid);
  db.prepare(`INSERT INTO family_memberships (family_id, person_id) VALUES (?, ?)`).run(famAId, memberPersonId);
  const memberSession = createSession(db, memberUserId);

  // Family B (Unrelated Family)
  const pwdFamBAdmin = hashPassword('FamBAdminPass123!');
  const famBAdminRes = db.prepare(`INSERT INTO users (email, password_hash, role) VALUES ('admin@beta.com', ?, 'family_admin')`).run(pwdFamBAdmin);
  const famBAdminUserId = Number(famBAdminRes.lastInsertRowid);
  const famBPersonRes = db.prepare(`INSERT INTO persons (display_name, user_id) VALUES ('Beta Admin', ?)`).run(famBAdminUserId);
  const famBPersonId = Number(famBPersonRes.lastInsertRowid);
  const famBRes = db.prepare(`INSERT INTO families (name, admin_user_id) VALUES ('Family Beta', ?)`).run(famBAdminUserId);
  const famBId = Number(famBRes.lastInsertRowid);
  db.prepare(`INSERT INTO family_memberships (family_id, person_id) VALUES (?, ?)`).run(famBId, famBPersonId);
  const famBAdminSession = createSession(db, famBAdminUserId);

  // Trip in Family B
  const tripBRes = db.prepare(`INSERT INTO trips (name, destination, created_by) VALUES ('Beta Trip', 'Ooty', ?)`).run(famBAdminUserId);
  const tripBId = Number(tripBRes.lastInsertRowid);
  db.prepare(`INSERT INTO trip_families (trip_id, family_id) VALUES (?, ?)`).run(tripBId, famBId);
  db.prepare(`INSERT INTO trip_participants (trip_id, person_id, attendance) VALUES (?, ?, 'coming')`).run(tripBId, famBPersonId);

  const app = createApp();

  return {
    db,
    app,
    superAdmin,
    superSession,
    famAdminUserId,
    famAdminPersonId,
    famAdminSession,
    famAId,
    memberUserId,
    memberPersonId,
    memberSession,
    famBId,
    famBPersonId,
    tripBId,
    famBAdminSession,
  };
}

test('9 & 12: Regular members and family admins cannot open admin dashboard data or bypass role checks', async () => {
  const env = setupAdminTestEnv();
  const server = env.app.listen(0);
  const port = (server.address() as any).port;
  const baseUrl = `http://127.0.0.1:${port}`;

  try {
    // 9. Regular member attempts to call /api/admin/overview
    const memberOverviewRes = await fetch(`${baseUrl}/api/admin/overview`, {
      headers: { Authorization: `Bearer ${env.memberSession.token}` },
    });
    assert.equal(memberOverviewRes.status, 403, 'Regular member must receive 403 Forbidden on admin overview');

    // Family admin attempts to call /api/admin/overview
    const famAdminOverviewRes = await fetch(`${baseUrl}/api/admin/overview`, {
      headers: { Authorization: `Bearer ${env.famAdminSession.token}` },
    });
    assert.equal(famAdminOverviewRes.status, 403, 'Family admin must receive 403 Forbidden on admin overview');

    // Unauthenticated request
    const unauthRes = await fetch(`${baseUrl}/api/admin/overview`);
    assert.equal(unauthRes.status, 401, 'Unauthenticated request must receive 401 Unauthorized');

    // 12. Direct API call to modify user status bypassing role checks
    const bypassRes = await fetch(`${baseUrl}/api/admin/members/${env.memberUserId}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${env.memberSession.token}`,
      },
      body: JSON.stringify({ is_active: 0 }),
    });
    assert.equal(bypassRes.status, 403, 'Direct call by member to admin endpoint must be rejected with 403');
  } finally {
    server.close();
  }
});

test('10 & 11: Family Admin cannot access unrelated families; Super Admin can access cross-family information', async () => {
  const env = setupAdminTestEnv();
  const server = env.app.listen(0);
  const port = (server.address() as any).port;
  const baseUrl = `http://127.0.0.1:${port}`;

  try {
    // 10. Family Admin A attempts to access Family B
    const famAAccessingB = await fetch(`${baseUrl}/api/families/${env.famBId}`, {
      headers: { Authorization: `Bearer ${env.famAdminSession.token}` },
    });
    assert.equal(famAAccessingB.status, 403, 'Family Admin A cannot access unrelated Family B');

    // Family Admin A attempts to access Trip B
    const famAAccessingTripB = await fetch(`${baseUrl}/api/trips/${env.tripBId}`, {
      headers: { Authorization: `Bearer ${env.famAdminSession.token}` },
    });
    assert.equal(famAAccessingTripB.status, 403, 'Family Admin A cannot access unrelated Trip B');

    // 11. Super Admin accesses cross-family data: overview, Family B, and Trip B
    const superOverviewRes = await fetch(`${baseUrl}/api/admin/overview`, {
      headers: { Authorization: `Bearer ${env.superSession.token}` },
    });
    assert.equal(superOverviewRes.status, 200, 'Super admin can access overview');
    const overviewData = await superOverviewRes.json();
    assert.equal(overviewData.metrics.total_families, 2);
    assert.equal(overviewData.metrics.total_trips, 1);

    const superTripRes = await fetch(`${baseUrl}/api/admin/trips/${env.tripBId}`, {
      headers: { Authorization: `Bearer ${env.superSession.token}` },
    });
    assert.equal(superTripRes.status, 200, 'Super admin can inspect any trip across families');
    const tripData = await superTripRes.json();
    assert.equal(tripData.trip.name, 'Beta Trip');
  } finally {
    server.close();
  }
});

test('13 & 14: Dedicated Super Admin login, brute-force protection, account deactivation, and audit record generation', async () => {
  const env = setupAdminTestEnv();
  const server = env.app.listen(0);
  const port = (server.address() as any).port;
  const baseUrl = `http://127.0.0.1:${port}`;

  try {
    // Member tries to log in through dedicated /api/admin/login -> Must be rejected with 403 Forbidden!
    const memberAdminLoginRes = await fetch(`${baseUrl}/api/admin/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'member@alpha.com', password: 'MemberPass123!' }),
    });
    assert.equal(memberAdminLoginRes.status, 403, 'Non-super-admin credentials must be rejected from /api/admin/login');

    // Valid Super Admin logs in via /api/admin/login
    const superLoginRes = await fetch(`${baseUrl}/api/admin/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'super@tripmates.local', password: 'SuperSecretPass123!' }),
    });
    assert.equal(superLoginRes.status, 200, 'Super admin can log in via /api/admin/login');
    const loginData = await superLoginRes.json();
    assert.ok(loginData.token);
    assert.equal(loginData.user.role, 'super_admin');

    // 14. Super Admin deactivates Member account -> Audit log must be generated
    const deactivateRes = await fetch(`${baseUrl}/api/admin/members/${env.memberUserId}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${env.superSession.token}`,
      },
      body: JSON.stringify({ is_active: 0 }),
    });
    assert.equal(deactivateRes.status, 200);

    // Verify member is now deactivated
    const memberRow = env.db.prepare('SELECT is_active FROM users WHERE id = ?').get(env.memberUserId) as any;
    assert.equal(memberRow.is_active, 0);

    // Verify deactivated member session was revoked
    const memberCheckSessionRes = await fetch(`${baseUrl}/api/trips`, {
      headers: { Authorization: `Bearer ${env.memberSession.token}` },
    });
    assert.equal(memberCheckSessionRes.status, 401, 'Deactivated member sessions must be revoked');

    // Check audit logs via /api/admin/audit
    const auditRes = await fetch(`${baseUrl}/api/admin/audit`, {
      headers: { Authorization: `Bearer ${env.superSession.token}` },
    });
    assert.equal(auditRes.status, 200);
    const auditData = await auditRes.json();
    const statusChangeLog = auditData.logs.find((l: any) => l.action === 'ADMIN_CHANGE_USER_STATUS');
    assert.ok(statusChangeLog, 'ADMIN_CHANGE_USER_STATUS audit record must be generated');
    assert.equal(statusChangeLog.actor_email, 'super@tripmates.local');
  } finally {
    server.close();
  }
});

test('Super Admin User Management: safe removal, deactivation, and self-protection', async () => {
  const env = setupAdminTestEnv();
  const server = env.app.listen(0);
  const port = (server.address() as any).port;
  const baseUrl = `http://127.0.0.1:${port}`;

  try {
    // 1. Super Admin attempts to remove themselves -> SELF_REMOVAL_PREVENTED
    const selfRemoveRes = await fetch(`${baseUrl}/api/admin/members/${env.superAdmin.id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${env.superSession.token}` },
    });
    assert.equal(selfRemoveRes.status, 400);
    const selfRemoveData = await selfRemoveRes.json();
    assert.equal(selfRemoveData.error, 'SELF_REMOVAL_PREVENTED');

    // 2. User with financial history: create an expense paid by member
    const personRow = env.db.prepare('SELECT id FROM persons WHERE user_id = ?').get(env.memberUserId) as any;
    env.db.prepare(`
      INSERT INTO expenses (trip_id, title, total_paise, expense_date, category, paid_by_type, paid_by_id, split_method, accounting_mode, created_by)
      VALUES (?, 'Test Lunch', 50000, '2026-05-01', 'Food', 'person', ?, 'equal', 'individual', ?)
    `).run(env.tripBId, personRow.id, env.memberUserId);

    // Call DELETE /api/admin/members/:userId for user with financial records
    const removeWithHistoryRes = await fetch(`${baseUrl}/api/admin/members/${env.memberUserId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${env.superSession.token}` },
    });
    assert.equal(removeWithHistoryRes.status, 200);
    const removeWithHistoryData = await removeWithHistoryRes.json();
    assert.equal(removeWithHistoryData.action, 'deactivated');

    // Verify user record still exists, but is_active = 0
    const userRow = env.db.prepare('SELECT is_active FROM users WHERE id = ?').get(env.memberUserId) as any;
    assert.equal(userRow.is_active, 0);

    // 3. User with zero financial history: create fresh user
    const freshRes = env.db.prepare(`
      INSERT INTO users (email, password_hash, role)
      VALUES ('fresh@delete.com', 'dummy_hash', 'member')
    `).run();
    const freshUserId = Number(freshRes.lastInsertRowid);
    env.db.prepare(`INSERT INTO persons (display_name, user_id) VALUES ('Fresh User', ?)`).run(freshUserId);

    const deleteFreshRes = await fetch(`${baseUrl}/api/admin/members/${freshUserId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${env.superSession.token}` },
    });
    assert.equal(deleteFreshRes.status, 200);
    const deleteFreshData = await deleteFreshRes.json();
    assert.equal(deleteFreshData.action, 'deleted');

    // Verify user was completely deleted from DB
    const deletedUserRow = env.db.prepare('SELECT id FROM users WHERE id = ?').get(freshUserId);
    assert.equal(deletedUserRow, undefined);
  } finally {
    server.close();
  }
});

test('Family Invite Codes: creation, registration, usage limit, and revocation', async () => {
  const env = setupAdminTestEnv();
  const server = env.app.listen(0);
  const port = (server.address() as any).port;
  const baseUrl = `http://127.0.0.1:${port}`;

  try {
    // 1. Super Admin creates invite code for Family A with max_uses = 1
    const createCodeRes = await fetch(`${baseUrl}/api/admin/invite-codes`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${env.superSession.token}`,
      },
      body: JSON.stringify({
        code: 'FAM-ALPHA26',
        family_id: env.famAId,
        max_uses: 1,
        notes: 'Test code for Alpha',
      }),
    });
    assert.equal(createCodeRes.status, 201);
    const codeData = await createCodeRes.json();
    assert.equal(codeData.code, 'FAM-ALPHA26');
    assert.equal(codeData.status, 'active');

    // 2. Register user using the valid invite code
    const regRes = await fetch(`${baseUrl}/api/auth/register-invite`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        invite_code: 'FAM-ALPHA26',
        email: 'invited_cousin@alpha.com',
        password: 'Password123!',
        displayName: 'Invited Cousin',
      }),
    });
    assert.equal(regRes.status, 201);
    const regData = await regRes.json();
    assert.equal(regData.user.email, 'invited_cousin@alpha.com');
    assert.equal(regData.family.id, env.famAId);

    // 3. Code was max_uses = 1; second attempt to register with exhausted code must fail
    const exhaustedRegRes = await fetch(`${baseUrl}/api/auth/register-invite`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        invite_code: 'FAM-ALPHA26',
        email: 'another_person@alpha.com',
        password: 'Password123!',
        displayName: 'Another Person',
      }),
    });
    assert.equal(exhaustedRegRes.status, 400);
    const exhaustedData = await exhaustedRegRes.json();
    assert.equal(exhaustedData.error, 'CODE_INACTIVE');

    // 4. Create another code and revoke it
    const createRevokeCodeRes = await fetch(`${baseUrl}/api/admin/invite-codes`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${env.superSession.token}`,
      },
      body: JSON.stringify({
        code: 'FAM-REVOKEME',
        max_uses: 5,
      }),
    });
    assert.equal(createRevokeCodeRes.status, 201);
    const revokeCodeObj = await createRevokeCodeRes.json();

    const revokeRes = await fetch(`${baseUrl}/api/admin/invite-codes/${revokeCodeObj.id}/revoke`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${env.superSession.token}` },
    });
    assert.equal(revokeRes.status, 200);

    // Attempting to register with revoked code must fail
    const revokedRegRes = await fetch(`${baseUrl}/api/auth/register-invite`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        invite_code: 'FAM-REVOKEME',
        email: 'revoked_test@beta.com',
        password: 'Password123!',
        displayName: 'Revoked Person',
      }),
    });
    assert.equal(revokedRegRes.status, 400);
  } finally {
    server.close();
  }
});

test('Trip Visiting Places: creation, ordering, and permissions', async () => {
  const env = setupAdminTestEnv();
  const server = env.app.listen(0);
  const port = (server.address() as any).port;
  const baseUrl = `http://127.0.0.1:${port}`;

  try {
    // 1. Regular member without creator permissions cannot add place to Trip B -> 403 Forbidden
    const unauthAddRes = await fetch(`${baseUrl}/api/trips/${env.tripBId}/places`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${env.memberSession.token}`,
      },
      body: JSON.stringify({
        name: 'Unauthorized Stop',
        latitude: 11.4102,
        longitude: 76.695,
      }),
    });
    assert.equal(unauthAddRes.status, 403);

    // 2. Trip Creator (famBAdminSession) adds visiting places
    const addStop1 = await fetch(`${baseUrl}/api/trips/${env.tripBId}/places`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${env.famBAdminSession.token}`,
      },
      body: JSON.stringify({
        name: 'Botanical Garden',
        latitude: 11.4150,
        longitude: 76.7050,
        notes: 'Morning stroll',
      }),
    });
    assert.equal(addStop1.status, 201);
    const stop1 = await addStop1.json();
    assert.equal(stop1.order_index, 0);

    const addStop2 = await fetch(`${baseUrl}/api/trips/${env.tripBId}/places`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${env.famBAdminSession.token}`,
      },
      body: JSON.stringify({
        name: 'Ooty Lake',
        latitude: 11.4075,
        longitude: 76.6890,
        notes: 'Boating at 2 PM',
      }),
    });
    assert.equal(addStop2.status, 201);
    const stop2 = await addStop2.json();
    assert.equal(stop2.order_index, 1);

    // 3. Family members can fetch route itinerary
    const listRes = await fetch(`${baseUrl}/api/trips/${env.tripBId}/places`, {
      headers: { Authorization: `Bearer ${env.famBAdminSession.token}` },
    });
    assert.equal(listRes.status, 200);
    const listData = await listRes.json();
    assert.equal(listData.places.length, 2);
    assert.equal(listData.places[0].name, 'Botanical Garden');
    assert.equal(listData.places[1].name, 'Ooty Lake');

    // 4. Reorder stops
    const reorderRes = await fetch(`${baseUrl}/api/trips/${env.tripBId}/places/reorder`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${env.famBAdminSession.token}`,
      },
      body: JSON.stringify({
        place_ids: [stop2.id, stop1.id],
      }),
    });
    assert.equal(reorderRes.status, 200);
    const reorderData = await reorderRes.json();
    assert.equal(reorderData.places[0].name, 'Ooty Lake');
    assert.equal(reorderData.places[1].name, 'Botanical Garden');

    // 5. Delete a place
    const deleteRes = await fetch(`${baseUrl}/api/trips/${env.tripBId}/places/${stop1.id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${env.famBAdminSession.token}` },
    });
    assert.equal(deleteRes.status, 200);

    // Verify only 1 place remaining
    const finalListRes = await fetch(`${baseUrl}/api/trips/${env.tripBId}/places`, {
      headers: { Authorization: `Bearer ${env.famBAdminSession.token}` },
    });
    const finalListData = await finalListRes.json();
    assert.equal(finalListData.places.length, 1);
    assert.equal(finalListData.places[0].name, 'Ooty Lake');
  } finally {
    server.close();
  }
});

test('Trip Invitation & Custom Cover Photo: available persons discovery and cover image access controls', async () => {
  const env = setupAdminTestEnv();
  const app = createApp();
  const server = app.listen(0);
  const port = (server.address() as any).port;
  const baseUrl = `http://localhost:${port}`;

  try {
    // 1. Available persons endpoint returns all active persons across the site
    const personsRes = await fetch(`${baseUrl}/api/persons/available`, {
      headers: { Authorization: `Bearer ${env.famAdminSession.token}` },
    });
    assert.equal(personsRes.status, 200);
    const personsData = await personsRes.json();
    assert.ok(Array.isArray(personsData));
    assert.ok(personsData.length >= 3);
    const names = personsData.map((p: any) => p.display_name);
    assert.ok(names.includes('Alice Admin'));
    assert.ok(names.includes('Bob Member'));
    assert.ok(names.includes('Beta Admin'));

    // 2. Create trip with custom cover photo
    const createTripRes = await fetch(`${baseUrl}/api/trips`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${env.famAdminSession.token}`,
      },
      body: JSON.stringify({
        name: 'Goa Holiday 2026',
        destination: 'Goa',
        cover_image: 'https://example.com/goa.jpg',
        participant_person_ids: [env.famAdminPersonId, env.memberPersonId, env.famBPersonId],
      }),
    });
    assert.equal(createTripRes.status, 201);
    const createdTrip = await createTripRes.json();
    assert.ok(createdTrip.id);
    const tripId = createdTrip.id;

    // Verify trip was created with the cover image
    const initialTripRes = await fetch(`${baseUrl}/api/trips/${tripId}`, {
      headers: { Authorization: `Bearer ${env.famAdminSession.token}` },
    });
    assert.equal(initialTripRes.status, 200);
    const initialTrip = await initialTripRes.json();
    assert.equal(initialTrip.cover_image, 'https://example.com/goa.jpg');
    assert.equal(initialTrip.participants.length, 3);

    // 3. Trip creator can update cover photo
    const updateCoverRes = await fetch(`${baseUrl}/api/trips/${tripId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${env.famAdminSession.token}`,
      },
      body: JSON.stringify({
        cover_image: 'https://example.com/goa-sunset.jpg',
      }),
    });
    assert.equal(updateCoverRes.status, 200);

    // Verify updated cover image
    const getTripRes = await fetch(`${baseUrl}/api/trips/${tripId}`, {
      headers: { Authorization: `Bearer ${env.famAdminSession.token}` },
    });
    assert.equal(getTripRes.status, 200);
    const tripData = await getTripRes.json();
    assert.equal(tripData.cover_image, 'https://example.com/goa-sunset.jpg');

    // 4. Super Admin can also update cover photo
    const adminCoverRes = await fetch(`${baseUrl}/api/trips/${tripId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${env.superSession.token}`,
      },
      body: JSON.stringify({
        cover_image: 'https://example.com/goa-admin-pick.jpg',
      }),
    });
    assert.equal(adminCoverRes.status, 200);

    // 5. Non-creator/non-admin participant cannot update cover photo
    const forbiddenCoverRes = await fetch(`${baseUrl}/api/trips/${tripId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${env.memberSession.token}`,
      },
      body: JSON.stringify({
        cover_image: 'https://example.com/hacked.jpg',
      }),
    });
    assert.equal(forbiddenCoverRes.status, 403);
  } finally {
    server.close();
  }
});

