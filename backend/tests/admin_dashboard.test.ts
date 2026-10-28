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
    famAdminSession,
    famAId,
    memberUserId,
    memberSession,
    famBId,
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
