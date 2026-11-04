import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { runMigrations } from '../src/db/migrations';
import { createInitialSuperAdmin } from '../src/auth/setup';
import { createSession } from '../src/auth/session';
import { createApp } from '../src/app';
import { setDb } from '../src/db/connection';
import { personKey } from '../src/finance';

test('Duplicate Expense Prevention: Blocks rapid double-submissions within 4s', async () => {
  const db = new DatabaseSync(':memory:');
  db.exec('PRAGMA foreign_keys = ON;');
  runMigrations(db);
  setDb(db);

  const { user, person } = createInitialSuperAdmin(
    db,
    'deduptest@tripmates.local',
    'Password123!',
    'Payer Tester'
  );
  const session = createSession(db, user.id);

  // Create a trip
  const tripRes = db.prepare(`
    INSERT INTO trips (name, destination, start_date, end_date, budget_paise, created_by)
    VALUES ('Goa Trip', 'Goa', '2026-11-01', '2026-11-05', 5000000, ?)
  `).run(user.id);
  const tripId = Number(tripRes.lastInsertRowid);

  // Add participant
  db.prepare(`
    INSERT INTO trip_participants (trip_id, person_id, attendance)
    VALUES (?, ?, 'coming')
  `).run(tripId, person.id);

  const app = createApp();
  const server = app.listen(0);
  const address = server.address() as any;
  const baseUrl = `http://127.0.0.1:${address.port}`;

  try {
    const payload = {
      title: 'Dinner at Beach Shack',
      expense_date: '2026-11-02',
      category: 'food',
      total_paise: 250000, // ₹2,500
      paid_by_type: 'person',
      paid_by_id: person.id,
      accounting_mode: 'individual',
      split_method: 'equal',
      participant_keys: [personKey(person.id)],
    };

    // 1. First submission should succeed with 201 Created
    const res1 = await fetch(`${baseUrl}/api/trips/${tripId}/expenses`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.token}`,
      },
      body: JSON.stringify(payload),
    });

    assert.equal(res1.status, 201, 'First expense submission must succeed with HTTP 201');
    const data1 = await res1.json();
    assert.equal(data1.title, 'Dinner at Beach Shack');

    // 2. Immediate second submission (identical payload) within 4 seconds should be rejected with 409 Conflict
    const res2 = await fetch(`${baseUrl}/api/trips/${tripId}/expenses`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.token}`,
      },
      body: JSON.stringify(payload),
    });

    assert.equal(res2.status, 409, 'Rapid duplicate submission must be rejected with HTTP 409');
    const data2 = await res2.json();
    assert.equal(data2.error, 'DUPLICATE_SUBMISSION');

    // 3. Different expense should NOT be blocked
    const payloadDiff = {
      ...payload,
      title: 'Scooter Rental',
      total_paise: 80000,
    };
    const res3 = await fetch(`${baseUrl}/api/trips/${tripId}/expenses`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.token}`,
      },
      body: JSON.stringify(payloadDiff),
    });
    assert.equal(res3.status, 201, 'Different expense must succeed with HTTP 201');

    // Verify only 2 expenses exist in DB (first and third, duplicate was prevented)
    const countRow = db.prepare('SELECT count(*) as count FROM expenses WHERE trip_id = ?').get(tripId) as any;
    assert.equal(countRow.count, 2, 'Exactly 2 expenses should be recorded in database; duplicate was blocked');
  } finally {
    server.close();
  }
});
