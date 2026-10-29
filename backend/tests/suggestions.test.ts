import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { runMigrations } from '../src/db/migrations';
import { hashPassword } from '../src/auth/password';
import { createSession } from '../src/auth/session';
import { createApp } from '../src/app';
import { setDb } from '../src/db/connection';
import type { Server } from 'node:http';

describe('Suggestions & Auth Aliases', () => {
  let db: DatabaseSync;
  let server: Server;
  let baseUrl: string;
  let adminToken: string;
  let memberToken: string;

  before(async () => {
    db = new DatabaseSync(':memory:');
    db.exec('PRAGMA foreign_keys = ON;');
    runMigrations(db);
    setDb(db);

    // Seed super admin
    const adminPass = hashPassword('SuperAdmin123!');
    const adminUserRes = db.prepare(`
      INSERT INTO users (email, password_hash, role)
      VALUES ('admin@tripmates.com', ?, 'super_admin')
    `).run(adminPass);
    const adminUserId = Number(adminUserRes.lastInsertRowid);
    db.prepare(`
      INSERT INTO persons (display_name, user_id)
      VALUES ('Surya Admin', ?)
    `).run(adminUserId);
    const adminSession = createSession(db, adminUserId);
    adminToken = adminSession.token;

    // Seed normal member
    const memberPass = hashPassword('MemberPassword123!');
    const memberUserRes = db.prepare(`
      INSERT INTO users (email, password_hash, role)
      VALUES ('member@tripmates.com', ?, 'member')
    `).run(memberPass);
    const memberUserId = Number(memberUserRes.lastInsertRowid);
    db.prepare(`
      INSERT INTO persons (display_name, user_id)
      VALUES ('Ananya Member', ?)
    `).run(memberUserId);
    const memberSession = createSession(db, memberUserId);
    memberToken = memberSession.token;

    const app = createApp();
    await new Promise<void>((resolve) => {
      server = app.listen(0, '127.0.0.1', () => {
        const port = (server.address() as any).port;
        baseUrl = `http://127.0.0.1:${port}`;
        resolve();
      });
    });
  });

  after(async () => {
    if (server) {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  test('Auth Aliases: /api/login and /api/signin work identically', async () => {
    const res1 = await fetch(`${baseUrl}/api/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'member@tripmates.com', password: 'MemberPassword123!' }),
    });
    assert.equal(res1.status, 200);
    const data1: any = await res1.json();
    assert.ok(data1.token);

    const res2 = await fetch(`${baseUrl}/api/signin`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'member@tripmates.com', password: 'MemberPassword123!' }),
    });
    assert.equal(res2.status, 200);
    const data2: any = await res2.json();
    assert.ok(data2.token);
  });

  test('Direct Registration: /api/register creates user, person and family without invite code', async () => {
    const res = await fetch(`${baseUrl}/api/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'newuser@tripmates.com',
        password: 'Password999!',
        displayName: 'Kiran Kumar',
      }),
    });

    assert.equal(res.status, 201);
    const data: any = await res.json();
    assert.equal(data.user.email, 'newuser@tripmates.com');
    assert.equal(data.person.display_name, 'Kiran Kumar');
    assert.ok(data.family);
    assert.ok(data.token);
  });

  test('Suggestions: Unauthenticated submission is rejected with 401', async () => {
    const res = await fetch(`${baseUrl}/api/suggestions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: 'Add dark mode',
        message: 'It would be great to have dark mode for night usage.',
        category: 'feature',
      }),
    });
    assert.equal(res.status, 401);
  });

  test('Suggestions: Member can submit suggestion and view under /my', async () => {
    const submitRes = await fetch(`${baseUrl}/api/suggestions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${memberToken}`,
      },
      body: JSON.stringify({
        title: 'Split by percentage shortcut',
        message: 'Please add 50-50 shortcut button in split expense screen.',
        category: 'improvement',
      }),
    });

    assert.equal(submitRes.status, 201);
    const submitData: any = await submitRes.json();
    assert.equal(submitData.suggestion.title, 'Split by percentage shortcut');
    assert.equal(submitData.suggestion.status, 'pending');
    assert.equal(submitData.suggestion.sender_name, 'Ananya Member');
    assert.equal(submitData.suggestion.sender_email, 'member@tripmates.com');

    const myRes = await fetch(`${baseUrl}/api/suggestions/my`, {
      headers: { Authorization: `Bearer ${memberToken}` },
    });

    assert.equal(myRes.status, 200);
    const myData: any = await myRes.json();
    assert.ok(Array.isArray(myData));
    assert.equal(myData.length, 1);
    assert.equal(myData[0].title, 'Split by percentage shortcut');
  });

  test('Suggestions: Regular members cannot access Super Admin suggestions endpoint (403)', async () => {
    const res = await fetch(`${baseUrl}/api/admin/suggestions`, {
      headers: { Authorization: `Bearer ${memberToken}` },
    });
    assert.equal(res.status, 403);
  });

  test('Suggestions: Super Admin can list, review, resolve, and delete suggestions', async () => {
    // 1. List
    const listRes = await fetch(`${baseUrl}/api/admin/suggestions`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });

    assert.equal(listRes.status, 200);
    const listData: any = await listRes.json();
    assert.ok(listData.length >= 1);
    const suggestionId = listData[0].id;

    // 2. Mark reviewed
    const reviewRes = await fetch(`${baseUrl}/api/admin/suggestions/${suggestionId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({ status: 'reviewed' }),
    });

    assert.equal(reviewRes.status, 200);
    const reviewData: any = await reviewRes.json();
    assert.equal(reviewData.suggestion.status, 'reviewed');

    // 3. Mark resolved
    const resolveRes = await fetch(`${baseUrl}/api/admin/suggestions/${suggestionId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({ status: 'resolved' }),
    });

    assert.equal(resolveRes.status, 200);
    const resolveData: any = await resolveRes.json();
    assert.equal(resolveData.suggestion.status, 'resolved');

    // 4. Delete inappropriate suggestion
    const deleteRes = await fetch(`${baseUrl}/api/admin/suggestions/${suggestionId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${adminToken}` },
    });

    assert.equal(deleteRes.status, 200);

    // Verify deletion
    const verifyRes = await fetch(`${baseUrl}/api/admin/suggestions`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const verifyData: any = await verifyRes.json();
    assert.ok(!verifyData.some((s: any) => s.id === suggestionId));
  });
});
