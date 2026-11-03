import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { runMigrations } from '../src/db/migrations';
import { createInitialSuperAdmin } from '../src/auth/setup';
import { createSession } from '../src/auth/session';
import { createApp } from '../src/app';
import { setDb } from '../src/db/connection';
import { personKey, familyKey } from '../src/finance';

function setupSimplifiedTestEnv() {
  const db = new DatabaseSync(':memory:');
  db.exec('PRAGMA foreign_keys = ON;');
  runMigrations(db);
  setDb(db);

  // Super Admin: Surya (Person 1)
  const { user: admin, person: p1 } = createInitialSuperAdmin(db, 'admin@tripmates.local', 'Admin123!', 'Surya');
  const session = createSession(db, admin.id);

  // Persons 2, 3, 4, 5
  const persons = [p1];
  for (let i = 2; i <= 5; i++) {
    const res = db.prepare(`INSERT INTO persons (display_name, is_active) VALUES (?, 1)`).run(`Person ${i}`);
    persons.push({ id: Number(res.lastInsertRowid), display_name: `Person ${i}`, user_id: null, is_active: 1 });
  }

  // Family A (Reddy Family): P1 and P2
  const famARes = db.prepare(`INSERT INTO families (name, is_active) VALUES ('Reddy Family', 1)`).run();
  const famAId = Number(famARes.lastInsertRowid);
  db.prepare(`INSERT INTO family_memberships (family_id, person_id) VALUES (?, ?)`).run(famAId, persons[0].id);
  db.prepare(`INSERT INTO family_memberships (family_id, person_id) VALUES (?, ?)`).run(famAId, persons[1].id);

  // Family B (Sharma Family): P3 and P4
  const famBRes = db.prepare(`INSERT INTO families (name, is_active) VALUES ('Sharma Family', 1)`).run();
  const famBId = Number(famBRes.lastInsertRowid);
  db.prepare(`INSERT INTO family_memberships (family_id, person_id) VALUES (?, ?)`).run(famBId, persons[2].id);
  db.prepare(`INSERT INTO family_memberships (family_id, person_id) VALUES (?, ?)`).run(famBId, persons[3].id);

  // Person 5 is an individual participant without a family

  // Create Trip
  const tripRes = db.prepare(`
    INSERT INTO trips (name, destination, budget_paise, created_by)
    VALUES ('Manali Trip', 'Manali', 10000000, ?)
  `).run(admin.id);
  const tripId = Number(tripRes.lastInsertRowid);

  // Add all 5 participants to the trip
  for (const p of persons) {
    db.prepare(`INSERT INTO trip_participants (trip_id, person_id, attendance) VALUES (?, ?, 'coming')`).run(tripId, p.id);
  }

  // Associate families with trip
  db.prepare(`INSERT INTO trip_families (trip_id, family_id) VALUES (?, ?)`).run(tripId, famAId);
  db.prepare(`INSERT INTO trip_families (trip_id, family_id) VALUES (?, ?)`).run(tripId, famBId);

  const app = createApp();

  return {
    db,
    app,
    admin,
    session,
    persons,
    famAId,
    famBId,
    tripId,
  };
}

test('1. EQUAL SPLIT -> PER HEAD: uneven amount & excluded non-eating members', async () => {
  const env = setupSimplifiedTestEnv();
  const server = env.app.listen(0);
  const port = (server.address() as any).port;
  const baseUrl = `http://127.0.0.1:${port}`;

  try {
    // Total ₹100 (10,000 paise). P1, P2, P3 ate. P4 and P5 did NOT eat.
    const payload = {
      title: 'Roadside Dhaba Lunch',
      expense_date: '2026-11-03',
      category: 'Food',
      paid_by_type: 'person',
      paid_by_id: env.persons[0].id, // P1 paid ₹100
      accounting_mode: 'individual',
      split_method: 'equal',
      total_paise: 10000, // ₹100
      participant_keys: [personKey(env.persons[0].id), personKey(env.persons[1].id), personKey(env.persons[2].id)],
    };

    // Preview verification
    const prevRes = await fetch(`${baseUrl}/api/trips/${env.tripId}/expenses/preview`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${env.session.token}` },
      body: JSON.stringify(payload),
    });
    assert.equal(prevRes.status, 200);
    const prevData = await prevRes.json();
    assert.equal(prevData.totalPaise, 10000);

    // Deterministic paise rounding: 10,000 / 3 = 3334, 3333, 3333
    const sumAlloc = prevData.allocations.reduce((acc: number, a: any) => acc + a.amount, 0);
    assert.equal(sumAlloc, 10000);

    // Save expense
    const saveRes = await fetch(`${baseUrl}/api/trips/${env.tripId}/expenses`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${env.session.token}` },
      body: JSON.stringify(payload),
    });
    assert.equal(saveRes.status, 201);
    const saved = await saveRes.json();

    // Verify GET detail
    const detailRes = await fetch(`${baseUrl}/api/trips/${env.tripId}/expenses/${saved.id}`, {
      headers: { Authorization: `Bearer ${env.session.token}` },
    });
    const detail = await detailRes.json();
    assert.equal(detail.total_paise, 10000);
    assert.equal(detail.allocations.length, 3);

    // Verify excluded members P4 and P5 are charged ₹0
    const chargedIds = detail.allocations.map((a: any) => a.account_id);
    assert.ok(!chargedIds.includes(env.persons[3].id));
    assert.ok(!chargedIds.includes(env.persons[4].id));
  } finally {
    server.close();
  }
});

test('2. EQUAL SPLIT -> FAMILY-WISE: divided equally among families and internal eating members', async () => {
  const env = setupSimplifiedTestEnv();
  const server = env.app.listen(0);
  const port = (server.address() as any).port;
  const baseUrl = `http://127.0.0.1:${port}`;

  try {
    // Expense ₹5,000 (500,000 paise).
    // Shared equally between Family A and Family B (₹2,500 each).
    // Family A (Reddy): P1 and P2 both ate -> ₹1,250 each.
    // Family B (Sharma): P3 ate, P4 did NOT eat (excluded from Family B) -> P3 owes ₹2,500, P4 owes ₹0.
    const famAKey = familyKey(env.famAId);
    const famBKey = familyKey(env.famBId);

    const payload = {
      title: 'Family Dinner Feast',
      expense_date: '2026-11-03',
      category: 'Food',
      paid_by_type: 'person',
      paid_by_id: env.persons[0].id,
      accounting_mode: 'family',
      split_method: 'family_wise',
      total_paise: 500000, // ₹5,000
      participant_keys: [famAKey, famBKey],
      family_breakdowns: {
        [famAKey]: [{ id: personKey(env.persons[0].id) }, { id: personKey(env.persons[1].id) }],
        [famBKey]: [{ id: personKey(env.persons[2].id) }], // Only P3 ate in Family B
      },
    };

    const saveRes = await fetch(`${baseUrl}/api/trips/${env.tripId}/expenses`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${env.session.token}` },
      body: JSON.stringify(payload),
    });
    assert.equal(saveRes.status, 201);
    const saved = await saveRes.json();

    const detailRes = await fetch(`${baseUrl}/api/trips/${env.tripId}/expenses/${saved.id}`, {
      headers: { Authorization: `Bearer ${env.session.token}` },
    });
    const detail = await detailRes.json();

    // Family allocations must be ₹2,500 each
    const famAllocMap = Object.fromEntries(detail.allocations.map((a: any) => [`f:${a.account_id}`, a.amount_paise]));
    assert.equal(famAllocMap[famAKey], 250000);
    assert.equal(famAllocMap[famBKey], 250000);

    // Family breakdown check
    const fbMap = Object.fromEntries(detail.family_breakdowns.map((fb: any) => [`p:${fb.person_id}`, fb.amount_paise]));
    assert.equal(fbMap[personKey(env.persons[0].id)], 125000); // P1 = ₹1,250
    assert.equal(fbMap[personKey(env.persons[1].id)], 125000); // P2 = ₹1,250
    assert.equal(fbMap[personKey(env.persons[2].id)], 250000); // P3 = ₹2,500
    assert.equal(fbMap[personKey(env.persons[3].id)], undefined); // P4 = ₹0 (excluded, did not eat)
  } finally {
    server.close();
  }
});

test('3. CUSTOM AMOUNT -> PER HEAD: exact example (₹1,500 + ₹1,000 + ₹1,500 + ₹1,000 = ₹5,000) & invalid rejection', async () => {
  const env = setupSimplifiedTestEnv();
  const server = env.app.listen(0);
  const port = (server.address() as any).port;
  const baseUrl = `http://127.0.0.1:${port}`;

  try {
    const p1 = env.persons[0].id;
    const p2 = env.persons[1].id;
    const p3 = env.persons[2].id;
    const p4 = env.persons[3].id;
    const p5 = env.persons[4].id; // Excluded

    // User Example:
    // Person A (P1) = ₹1,500
    // Person B (P2) = ₹1,000
    // Person C (P3) = ₹1,500
    // Person D (P4) = ₹1,000
    // Total = ₹5,000
    const payload = {
      title: 'Buffet Dinner with Custom Shares',
      expense_date: '2026-11-03',
      category: 'Food',
      paid_by_type: 'person',
      paid_by_id: p1,
      accounting_mode: 'individual',
      split_method: 'custom',
      total_paise: 500000, // ₹5,000
      custom_entries: [
        { id: `p:${p1}`, amount_paise: 150000 },
        { id: `p:${p2}`, amount_paise: 100000 },
        { id: `p:${p3}`, amount_paise: 150000 },
        { id: `p:${p4}`, amount_paise: 100000 },
      ],
    };

    const saveRes = await fetch(`${baseUrl}/api/trips/${env.tripId}/expenses`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${env.session.token}` },
      body: JSON.stringify(payload),
    });
    assert.equal(saveRes.status, 201);
    const saved = await saveRes.json();

    const detailRes = await fetch(`${baseUrl}/api/trips/${env.tripId}/expenses/${saved.id}`, {
      headers: { Authorization: `Bearer ${env.session.token}` },
    });
    const detail = await detailRes.json();
    const map = Object.fromEntries(detail.allocations.map((a: any) => [`p:${a.account_id}`, a.amount_paise]));

    assert.equal(map[`p:${p1}`], 150000);
    assert.equal(map[`p:${p2}`], 100000);
    assert.equal(map[`p:${p3}`], 150000);
    assert.equal(map[`p:${p4}`], 100000);
    assert.equal(map[`p:${p5}`], undefined); // Excluded participant owes ₹0

    // Test rejection when custom entries do NOT equal the total bill
    const invalidPayload = {
      ...payload,
      custom_entries: [
        { id: `p:${p1}`, amount_paise: 150000 },
        { id: `p:${p2}`, amount_paise: 100000 },
        // Short by ₹2,500
      ],
    };
    const badRes = await fetch(`${baseUrl}/api/trips/${env.tripId}/expenses`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${env.session.token}` },
      body: JSON.stringify(invalidPayload),
    });
    assert.equal(badRes.status, 400);
  } finally {
    server.close();
  }
});

test('4. CUSTOM AMOUNT -> FAMILY-WISE: exact example (Family A = ₹3,000, Family B = ₹2,000, Total = ₹5,000)', async () => {
  const env = setupSimplifiedTestEnv();
  const server = env.app.listen(0);
  const port = (server.address() as any).port;
  const baseUrl = `http://127.0.0.1:${port}`;

  try {
    const famAKey = familyKey(env.famAId);
    const famBKey = familyKey(env.famBId);

    // User Example:
    // Family A = ₹3,000
    // Family B = ₹2,000
    // Total = ₹5,000
    // Family A distributes internally: P1 = ₹1,800, P2 = ₹1,200
    // Family B distributes internally: P3 = ₹2,000, P4 did not eat (₹0)
    const payload = {
      title: 'Villa Stay Custom Contribution',
      expense_date: '2026-11-03',
      category: 'Stay',
      paid_by_type: 'person',
      paid_by_id: env.persons[0].id,
      accounting_mode: 'family',
      split_method: 'family_wise',
      total_paise: 500000, // ₹5,000
      custom_entries: [
        { id: famAKey, amount_paise: 300000 },
        { id: famBKey, amount_paise: 200000 },
      ],
      family_breakdowns: {
        [famAKey]: [
          { id: personKey(env.persons[0].id), amount: 180000 },
          { id: personKey(env.persons[1].id), amount: 120000 },
        ],
        [famBKey]: [
          { id: personKey(env.persons[2].id), amount: 200000 },
        ],
      },
    };

    const saveRes = await fetch(`${baseUrl}/api/trips/${env.tripId}/expenses`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${env.session.token}` },
      body: JSON.stringify(payload),
    });
    assert.equal(saveRes.status, 201);
    const saved = await saveRes.json();

    const detailRes = await fetch(`${baseUrl}/api/trips/${env.tripId}/expenses/${saved.id}`, {
      headers: { Authorization: `Bearer ${env.session.token}` },
    });
    const detail = await detailRes.json();

    const famMap = Object.fromEntries(detail.allocations.map((a: any) => [`f:${a.account_id}`, a.amount_paise]));
    assert.equal(famMap[famAKey], 300000); // Family A = ₹3,000
    assert.equal(famMap[famBKey], 200000); // Family B = ₹2,000

    const memMap = Object.fromEntries(detail.family_breakdowns.map((fb: any) => [`p:${fb.person_id}`, fb.amount_paise]));
    assert.equal(memMap[personKey(env.persons[0].id)], 180000);
    assert.equal(memMap[personKey(env.persons[1].id)], 120000);
    assert.equal(memMap[personKey(env.persons[2].id)], 200000);
    assert.equal(memMap[personKey(env.persons[3].id)], undefined); // P4 excluded
  } finally {
    server.close();
  }
});

test('5. EDITING AN EXPENSE (PUT): updates allocations, preserves persistence, updates ledger', async () => {
  const env = setupSimplifiedTestEnv();
  const server = env.app.listen(0);
  const port = (server.address() as any).port;
  const baseUrl = `http://127.0.0.1:${port}`;

  try {
    const p1 = env.persons[0].id;
    const p2 = env.persons[1].id;
    const p3 = env.persons[2].id;

    // Step 1: Create expense of ₹3,000 split equally between P1, P2, P3 (₹1,000 each)
    const initialPayload = {
      title: 'Initial Team Dinner',
      expense_date: '2026-11-03',
      category: 'Food',
      paid_by_type: 'person',
      paid_by_id: p1,
      accounting_mode: 'individual',
      split_method: 'equal',
      total_paise: 300000,
      participant_keys: [`p:${p1}`, `p:${p2}`, `p:${p3}`],
    };

    const createRes = await fetch(`${baseUrl}/api/trips/${env.tripId}/expenses`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${env.session.token}` },
      body: JSON.stringify(initialPayload),
    });
    assert.equal(createRes.status, 201);
    const created = await createRes.json();

    // Check initial ledger
    let ledgerRes = await fetch(`${baseUrl}/api/trips/${env.tripId}/ledger`, {
      headers: { Authorization: `Bearer ${env.session.token}` },
    });
    let ledger = await ledgerRes.json();
    let b1 = ledger.balances.find((b: any) => b.key === `p:${p1}`);
    let b2 = ledger.balances.find((b: any) => b.key === `p:${p2}`);
    // P1 paid 3,000, share 1,000 -> net +2,000 (receives ₹2,000)
    assert.equal(b1.net, 200000);
    // P2 paid 0, share 1,000 -> net -1,000 (owes ₹1,000)
    assert.equal(b2.net, -100000);

    // Step 2: Edit the expense: change total to ₹4,000, change to Custom Amount (P1 = ₹2,000, P2 = ₹2,000; P3 excluded!)
    const updatePayload = {
      title: 'Updated Dinner (P3 was not there)',
      expense_date: '2026-11-03',
      category: 'Food',
      paid_by_type: 'person',
      paid_by_id: p1,
      accounting_mode: 'individual',
      split_method: 'custom',
      total_paise: 400000, // ₹4,000
      custom_entries: [
        { id: `p:${p1}`, amount_paise: 200000 },
        { id: `p:${p2}`, amount_paise: 200000 },
      ],
    };

    const editRes = await fetch(`${baseUrl}/api/trips/${env.tripId}/expenses/${created.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${env.session.token}` },
      body: JSON.stringify(updatePayload),
    });
    assert.equal(editRes.status, 200);

    // Step 3: Verify GET detail reflects updated state
    const detailRes = await fetch(`${baseUrl}/api/trips/${env.tripId}/expenses/${created.id}`, {
      headers: { Authorization: `Bearer ${env.session.token}` },
    });
    const detail = await detailRes.json();
    assert.equal(detail.title, 'Updated Dinner (P3 was not there)');
    assert.equal(detail.total_paise, 400000);
    assert.equal(detail.split_method, 'custom');
    assert.equal(detail.allocations.length, 2);

    // Step 4: Verify ledger recalculates automatically and reconciles to zero
    ledgerRes = await fetch(`${baseUrl}/api/trips/${env.tripId}/ledger`, {
      headers: { Authorization: `Bearer ${env.session.token}` },
    });
    ledger = await ledgerRes.json();
    b1 = ledger.balances.find((b: any) => b.key === `p:${p1}`);
    b2 = ledger.balances.find((b: any) => b.key === `p:${p2}`);
    const b3 = ledger.balances.find((b: any) => b.key === `p:${p3}`);

    // P1 paid 4,000, share 2,000 -> net +2,000
    assert.equal(b1.net, 200000);
    // P2 paid 0, share 2,000 -> net -2,000
    assert.equal(b2.net, -200000);
    // P3 is now excluded -> owes 0
    assert.ok(!b3 || b3.net === 0);

    // Total net is zero
    const sumNets = ledger.balances.reduce((acc: number, b: any) => acc + b.net, 0);
    assert.equal(sumNets, 0);
  } finally {
    server.close();
  }
});

test('6. DELETING / VOIDING AN EXPENSE & REPAYMENTS: ledger cleans up and settlements stay accurate', async () => {
  const env = setupSimplifiedTestEnv();
  const server = env.app.listen(0);
  const port = (server.address() as any).port;
  const baseUrl = `http://127.0.0.1:${port}`;

  try {
    const p1 = env.persons[0].id;
    const p2 = env.persons[1].id;

    // Create ₹2,000 expense (P1 paid, P1 and P2 split ₹1,000 each)
    const expRes = await fetch(`${baseUrl}/api/trips/${env.tripId}/expenses`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${env.session.token}` },
      body: JSON.stringify({
        title: 'Taxi to Resort',
        expense_date: '2026-11-03',
        category: 'Transport',
        paid_by_type: 'person',
        paid_by_id: p1,
        accounting_mode: 'individual',
        split_method: 'equal',
        total_paise: 200000,
        participant_keys: [`p:${p1}`, `p:${p2}`],
      }),
    });
    assert.equal(expRes.status, 201);
    const exp = await expRes.json();

    // Record repayment: P2 pays ₹1,000 to P1
    const repRes = await fetch(`${baseUrl}/api/trips/${env.tripId}/repayments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${env.session.token}` },
      body: JSON.stringify({
        from_type: 'person',
        from_id: p2,
        to_type: 'person',
        to_id: p1,
        amount_paise: 100000,
        paid_on: '2026-11-03',
        reference: 'UPI-12345',
      }),
    });
    assert.equal(repRes.status, 201);

    // Ledger before voiding: both should be settled (net = 0)
    let ledgerRes = await fetch(`${baseUrl}/api/trips/${env.tripId}/ledger`, {
      headers: { Authorization: `Bearer ${env.session.token}` },
    });
    let ledger = await ledgerRes.json();
    let b1 = ledger.balances.find((b: any) => b.key === `p:${p1}`);
    let b2 = ledger.balances.find((b: any) => b.key === `p:${p2}`);
    assert.equal(b1.net, 0);
    assert.equal(b2.net, 0);

    // Void the expense
    const voidRes = await fetch(`${baseUrl}/api/trips/${env.tripId}/expenses/${exp.id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${env.session.token}` },
    });
    assert.equal(voidRes.status, 200);

    // Ledger after voiding: expense is gone, only repayment remains (P2 sent ₹1,000 -> P2 net = +1,000, P1 net = -1,000)
    ledgerRes = await fetch(`${baseUrl}/api/trips/${env.tripId}/ledger`, {
      headers: { Authorization: `Bearer ${env.session.token}` },
    });
    ledger = await ledgerRes.json();
    b1 = ledger.balances.find((b: any) => b.key === `p:${p1}`);
    b2 = ledger.balances.find((b: any) => b.key === `p:${p2}`);
    assert.equal(b2.net, 100000);
    assert.equal(b1.net, -100000);
  } finally {
    server.close();
  }
});

