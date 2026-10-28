import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { runMigrations } from '../src/db/migrations';
import { createInitialSuperAdmin } from '../src/auth/setup';
import { createSession } from '../src/auth/session';
import { createApp } from '../src/app';
import { setDb } from '../src/db/connection';
import { personKey, familyKey } from '../src/finance';

function setupExpenseTestEnv() {
  const db = new DatabaseSync(':memory:');
  db.exec('PRAGMA foreign_keys = ON;');
  runMigrations(db);
  setDb(db);

  // Setup Admin
  const { user: admin, person: adminPerson } = createInitialSuperAdmin(db, 'admin@tripmates.local', 'Admin123!', 'Surya');
  const session = createSession(db, admin.id);

  // Create 10 participants: Person 1 (Surya) + Persons 2..10
  const persons = [adminPerson];
  for (let i = 2; i <= 10; i++) {
    const res = db.prepare(`INSERT INTO persons (display_name, is_active) VALUES (?, 1)`).run(`Person ${i}`);
    persons.push({ id: Number(res.lastInsertRowid), display_name: `Person ${i}`, user_id: null, is_active: 1 });
  }

  // Create a Family (Family 1) with Person 2 and Person 3
  const famRes = db.prepare(`INSERT INTO families (name, is_active) VALUES ('Reddy Family', 1)`).run();
  const famId = Number(famRes.lastInsertRowid);
  db.prepare(`INSERT INTO family_memberships (family_id, person_id) VALUES (?, ?)`).run(famId, persons[1].id);
  db.prepare(`INSERT INTO family_memberships (family_id, person_id) VALUES (?, ?)`).run(famId, persons[2].id);

  // Create a Trip
  const tripRes = db.prepare(`
    INSERT INTO trips (name, destination, budget_paise, created_by)
    VALUES ('Goa Holiday', 'Goa', 5000000, ?)
  `).run(admin.id);
  const tripId = Number(tripRes.lastInsertRowid);

  // Add all 10 participants to the trip
  for (const p of persons) {
    db.prepare(`INSERT INTO trip_participants (trip_id, person_id, attendance) VALUES (?, ?, 'coming')`).run(tripId, p.id);
  }

  const app = createApp();

  return {
    db,
    app,
    admin,
    session,
    persons,
    famId,
    tripId,
  };
}

test('ACCEPTANCE: Three idly plates at ₹50 and four puri plates at ₹80 must total ₹470. Only assigned participants owe their shares.', async () => {
  const env = setupExpenseTestEnv();
  const server = env.app.listen(0);
  const port = (server.address() as any).port;
  const baseUrl = `http://127.0.0.1:${port}`;

  try {
    // P1..P3 eat Idly (3 plates @ ₹50 = ₹150 -> ₹50 each)
    // P4..P7 eat Puri (4 plates @ ₹80 = ₹320 -> ₹80 each)
    // P8..P10 did not eat anything -> owe ₹0
    const payload = {
      title: 'South Indian Breakfast',
      expense_date: '2026-10-24',
      category: 'Food',
      paid_by_type: 'person',
      paid_by_id: env.persons[0].id, // Paid by Surya
      accounting_mode: 'individual',
      split_method: 'itemized',
      items: [
        {
          name: 'Idly',
          unitPrice: 5000, // 5000 paise = ₹50
          quantity: 3,
          assignees: [personKey(env.persons[0].id), personKey(env.persons[1].id), personKey(env.persons[2].id)],
        },
        {
          name: 'Puri',
          unitPrice: 8000, // 8000 paise = ₹80
          quantity: 4,
          assignees: [
            personKey(env.persons[3].id),
            personKey(env.persons[4].id),
            personKey(env.persons[5].id),
            personKey(env.persons[6].id),
          ],
        },
      ],
    };

    const res = await fetch(`${baseUrl}/api/trips/${env.tripId}/expenses`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${env.session.token}`,
      },
      body: JSON.stringify(payload),
    });

    assert.equal(res.status, 201);
    const data = await res.json();

    // Total must be 47,000 paise = ₹470
    assert.equal(data.totalPaise, 47000);

    // Verify detailed expense query
    const detailRes = await fetch(`${baseUrl}/api/trips/${env.tripId}/expenses/${data.id}`, {
      headers: { Authorization: `Bearer ${env.session.token}` },
    });
    const detail = await detailRes.json();

    assert.equal(detail.total_paise, 47000);
    assert.equal(detail.items.length, 2);

    // Allocations check: P1..P3 owe ₹50 (5000 paise), P4..P7 owe ₹80 (8000 paise)
    const allocMap = new Map<string, number>();
    for (const a of detail.allocations) {
      allocMap.set(`${a.account_type}:${a.account_id}`, a.amount_paise);
    }

    assert.equal(allocMap.get(`person:${env.persons[0].id}`), 5000);
    assert.equal(allocMap.get(`person:${env.persons[1].id}`), 5000);
    assert.equal(allocMap.get(`person:${env.persons[2].id}`), 5000);
    assert.equal(allocMap.get(`person:${env.persons[3].id}`), 8000);
    assert.equal(allocMap.get(`person:${env.persons[4].id}`), 8000);
    assert.equal(allocMap.get(`person:${env.persons[5].id}`), 8000);
    assert.equal(allocMap.get(`person:${env.persons[6].id}`), 8000);

    // Unassigned participants P8..P10 must NOT appear in allocations (owe ₹0)
    assert.equal(allocMap.has(`person:${env.persons[7].id}`), false);
    assert.equal(allocMap.has(`person:${env.persons[8].id}`), false);
    assert.equal(allocMap.has(`person:${env.persons[9].id}`), false);
  } finally {
    server.close();
  }
});

test('ACCEPTANCE: ₹3,000 expense shared equally by 6 out of 10 participants allocates ₹500 to each selected and ₹0 to others; payer is owed ₹2,500', async () => {
  const env = setupExpenseTestEnv();
  const server = env.app.listen(0);
  const port = (server.address() as any).port;
  const baseUrl = `http://127.0.0.1:${port}`;

  try {
    // 6 selected participants: Person 1 (Surya, payer) + Persons 2..6
    const selectedKeys = [
      personKey(env.persons[0].id),
      personKey(env.persons[1].id),
      personKey(env.persons[2].id),
      personKey(env.persons[3].id),
      personKey(env.persons[4].id),
      personKey(env.persons[5].id),
    ];

    const payload = {
      title: 'Grand Lunch',
      expense_date: '2026-10-24',
      category: 'Food',
      paid_by_type: 'person',
      paid_by_id: env.persons[0].id, // Surya
      accounting_mode: 'individual',
      split_method: 'equal',
      total_paise: 300000, // ₹3,000 = 300,000 paise
      participant_keys: selectedKeys,
    };

    const res = await fetch(`${baseUrl}/api/trips/${env.tripId}/expenses`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${env.session.token}`,
      },
      body: JSON.stringify(payload),
    });

    assert.equal(res.status, 201);
    const data = await res.json();
    assert.equal(data.totalPaise, 300000);

    // Summary check:
    // Payer own share: ₹500 (50,000 paise)
    // Recoverable from other 5 participants: ₹2,500 (250,000 paise)
    assert.equal(data.summary.payerOwnShare, 50000);
    assert.equal(data.summary.recoverable, 250000);

    // Check ledger balances
    const ledgerRes = await fetch(`${baseUrl}/api/trips/${env.tripId}/ledger`, {
      headers: { Authorization: `Bearer ${env.session.token}` },
    });
    assert.equal(ledgerRes.status, 200);
    const ledger = await ledgerRes.json();

    const balanceMap = new Map<string, any>();
    for (const b of ledger.balances) {
      balanceMap.set(b.key, b);
    }

    // Payer (Surya, p:1):
    // Paid 300,000, Share 50,000 -> Net = +250,000 (should receive ₹2,500)
    const payerBalance = balanceMap.get(`p:${env.persons[0].id}`);
    assert.equal(payerBalance.paid, 300000);
    assert.equal(payerBalance.share, 50000);
    assert.equal(payerBalance.net, 250000);
    assert.equal(payerBalance.status, 'receives');

    // The other 5 participants (p:2..p:6):
    // Paid 0, Share 50,000 -> Net = -50,000 (each owes ₹500)
    for (let i = 1; i < 6; i++) {
      const b = balanceMap.get(`p:${env.persons[i].id}`);
      assert.equal(b.paid, 0);
      assert.equal(b.share, 50000);
      assert.equal(b.net, -50000);
      assert.equal(b.status, 'owes');
    }

    // The 4 unselected participants (p:7..p:10):
    // Should have 0 share, 0 net (owe nothing)
    for (let i = 6; i < 10; i++) {
      const b = balanceMap.get(`p:${env.persons[i].id}`);
      assert.ok(!b || b.net === 0);
    }

    // Reconciles to zero
    const sumNets = ledger.balances.reduce((acc: number, b: any) => acc + b.net, 0);
    assert.equal(sumNets, 0);
  } finally {
    server.close();
  }
});

test('ACCEPTANCE: Family shares must not be charged again to individual members as additional group debt', async () => {
  const env = setupExpenseTestEnv();
  const server = env.app.listen(0);
  const port = (server.address() as any).port;
  const baseUrl = `http://127.0.0.1:${port}`;

  try {
    // Mixed mode expense:
    // Total = ₹2,000 (200,000 paise)
    // Family 1 (Reddy Family) share = ₹1,200 (120,000 paise) [broken down as ₹600 each for Person 2 and Person 3]
    // Person 4 share = ₹800 (80,000 paise)
    // Paid by Person 1 (Surya)
    const payload = {
      title: 'Resort Cottage Booking',
      expense_date: '2026-10-24',
      category: 'Stay',
      paid_by_type: 'person',
      paid_by_id: env.persons[0].id,
      accounting_mode: 'mixed',
      split_method: 'family_wise',
      total_paise: 200000,
      mixed_parts: [
        {
          type: 'family',
          id: String(env.famId),
          amount: 120000,
          members: {
            ids: [personKey(env.persons[1].id), personKey(env.persons[2].id)],
          },
        },
        {
          type: 'person',
          id: String(env.persons[3].id),
          amount: 80000,
        },
      ],
    };

    const res = await fetch(`${baseUrl}/api/trips/${env.tripId}/expenses`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${env.session.token}`,
      },
      body: JSON.stringify(payload),
    });

    assert.equal(res.status, 201);
    const data = await res.json();
    assert.equal(data.totalPaise, 200000);

    // Ledger inspection:
    // Only f:1 (Family 1) and p:4 owe money.
    // Person 2 and Person 3 must NOT have individual debts in the group ledger.
    const ledgerRes = await fetch(`${baseUrl}/api/trips/${env.tripId}/ledger`, {
      headers: { Authorization: `Bearer ${env.session.token}` },
    });
    const ledger = await ledgerRes.json();

    const balanceMap = new Map<string, any>();
    for (const b of ledger.balances) {
      balanceMap.set(b.key, b);
    }

    const famBalance = balanceMap.get(`f:${env.famId}`);
    assert.equal(famBalance.share, 120000);
    assert.equal(famBalance.net, -120000); // Family owes ₹1,200

    const p4Balance = balanceMap.get(`p:${env.persons[3].id}`);
    assert.equal(p4Balance.share, 80000);
    assert.equal(p4Balance.net, -80000); // Person 4 owes ₹800

    // Person 2 and Person 3 do NOT owe extra group debt:
    const p2Balance = balanceMap.get(`p:${env.persons[1].id}`);
    const p3Balance = balanceMap.get(`p:${env.persons[2].id}`);
    assert.ok(!p2Balance || p2Balance.share === 0);
    assert.ok(!p3Balance || p3Balance.share === 0);

    // Total group debts = 120,000 + 80,000 = 200,000. Reconciles exactly to payer net +200,000.
    const payerBalance = balanceMap.get(`p:${env.persons[0].id}`);
    assert.equal(payerBalance.net, 200000);
    assert.equal(ledger.balances.reduce((acc: number, b: any) => acc + b.net, 0), 0);
  } finally {
    server.close();
  }
});

test('ACCEPTANCE: Repayments - partial, full, and rejection of overpayment / duplicate', async () => {
  const env = setupExpenseTestEnv();
  const server = env.app.listen(0);
  const port = (server.address() as any).port;
  const baseUrl = `http://127.0.0.1:${port}`;

  try {
    // Surya (P1) pays ₹1,000 split equally between Surya (P1) and Person 2 (P2)
    // Person 2 owes ₹500 (50,000 paise)
    await fetch(`${baseUrl}/api/trips/${env.tripId}/expenses`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${env.session.token}`,
      },
      body: JSON.stringify({
        title: 'Taxi',
        expense_date: '2026-10-24',
        category: 'Travel',
        paid_by_type: 'person',
        paid_by_id: env.persons[0].id,
        accounting_mode: 'individual',
        split_method: 'equal',
        total_paise: 100000,
        participant_keys: [personKey(env.persons[0].id), personKey(env.persons[1].id)],
      }),
    });

    // 1. Overpayment rejection: P2 tries to repay ₹600 (owed is only ₹500)
    const overpayRes = await fetch(`${baseUrl}/api/trips/${env.tripId}/repayments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${env.session.token}`,
      },
      body: JSON.stringify({
        from_type: 'person',
        from_id: env.persons[1].id,
        to_type: 'person',
        to_id: env.persons[0].id,
        amount_paise: 60000, // ₹600
        paid_on: '2026-10-24',
      }),
    });
    assert.equal(overpayRes.status, 400);
    const overpayJson = await overpayRes.json();
    assert.equal(overpayJson.error, 'REPAYMENT_VALIDATION_ERROR');

    // 2. Partial repayment: P2 repays ₹200 (20,000 paise)
    const partialRes = await fetch(`${baseUrl}/api/trips/${env.tripId}/repayments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${env.session.token}`,
      },
      body: JSON.stringify({
        from_type: 'person',
        from_id: env.persons[1].id,
        to_type: 'person',
        to_id: env.persons[0].id,
        amount_paise: 20000,
        paid_on: '2026-10-24',
        reference: 'UPI-PARTIAL-1',
      }),
    });
    assert.equal(partialRes.status, 201);

    // 3. Duplicate repayment rejection: identical repayment
    const dupRes = await fetch(`${baseUrl}/api/trips/${env.tripId}/repayments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${env.session.token}`,
      },
      body: JSON.stringify({
        from_type: 'person',
        from_id: env.persons[1].id,
        to_type: 'person',
        to_id: env.persons[0].id,
        amount_paise: 20000,
        paid_on: '2026-10-24',
        reference: 'UPI-PARTIAL-1',
      }),
    });
    assert.equal(dupRes.status, 400);

    // Check remaining balance: P2 should now owe ₹300 (30,000 paise)
    const ledger1Res = await fetch(`${baseUrl}/api/trips/${env.tripId}/ledger`, {
      headers: { Authorization: `Bearer ${env.session.token}` },
    });
    const ledger1 = await ledger1Res.json();
    const p2Balance = ledger1.balances.find((b: any) => b.key === `p:${env.persons[1].id}`);
    assert.equal(p2Balance.net, -30000);

    // 4. Complete final repayment of ₹300
    const finalRes = await fetch(`${baseUrl}/api/trips/${env.tripId}/repayments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${env.session.token}`,
      },
      body: JSON.stringify({
        from_type: 'person',
        from_id: env.persons[1].id,
        to_type: 'person',
        to_id: env.persons[0].id,
        amount_paise: 30000,
        paid_on: '2026-10-24',
        reference: 'UPI-FINAL-2',
      }),
    });
    assert.equal(finalRes.status, 201);

    // After full repayment, settlement status must be 'settled'
    const ledgerFinalRes = await fetch(`${baseUrl}/api/trips/${env.tripId}/ledger`, {
      headers: { Authorization: `Bearer ${env.session.token}` },
    });
    const ledgerFinal = await ledgerFinalRes.json();
    assert.equal(ledgerFinal.status, 'settled');
    for (const b of ledgerFinal.balances) {
      assert.equal(b.net, 0);
    }
  } finally {
    server.close();
  }
});

test('ACCEPTANCE: Individual Amount + Equal Shared Remainder (₹3,000 across 5 participants: portions ₹300, ₹500, ₹0, ₹200, ₹0)', async () => {
  const env = setupExpenseTestEnv();
  const server = env.app.listen(0);
  const port = (server.address() as any).port;
  const baseUrl = `http://127.0.0.1:${port}`;

  try {
    const p1 = env.persons[0].id;
    const p2 = env.persons[1].id;
    const p3 = env.persons[2].id;
    const p4 = env.persons[3].id;
    const p5 = env.persons[4].id;

    const payload = {
      title: 'Group Dinner & Drinks',
      expense_date: '2026-10-25',
      category: 'Food',
      paid_by_type: 'person',
      paid_by_id: p1, // Surya paid ₹3,000
      accounting_mode: 'individual',
      split_method: 'individual_remainder',
      total_paise: 300000, // ₹3,000
      individual_remainder_entries: [
        { id: `p:${p1}`, individual_amount_paise: 30000 }, // ₹300
        { id: `p:${p2}`, individual_amount_paise: 50000 }, // ₹500
        { id: `p:${p3}`, individual_amount_paise: 0 },     // ₹0
        { id: `p:${p4}`, individual_amount_paise: 20000 }, // ₹200
        { id: `p:${p5}`, individual_amount_paise: 0 },     // ₹0
      ],
    };

    // 1. Preview calculation
    const prevRes = await fetch(`${baseUrl}/api/trips/${env.tripId}/expenses/preview`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${env.session.token}`,
      },
      body: JSON.stringify(payload),
    });
    assert.equal(prevRes.status, 200);
    const prevData = await prevRes.json();
    assert.equal(prevData.totalPaise, 300000);

    const prevMap = Object.fromEntries(prevData.allocations.map((a: any) => [a.id, a.amount]));
    assert.deepEqual(prevMap, {
      [`p:${p1}`]: 70000, // ₹700
      [`p:${p2}`]: 90000, // ₹900
      [`p:${p3}`]: 40000, // ₹400
      [`p:${p4}`]: 60000, // ₹600
      [`p:${p5}`]: 40000, // ₹400
    });
    // Payer own share ₹700, recoverable ₹2,300
    assert.equal(prevData.summary.paidBy, `p:${p1}`);
    assert.equal(prevData.summary.payerOwnShare, 70000);
    assert.equal(prevData.summary.recoverable, 230000);

    // 2. Save expense
    const saveRes = await fetch(`${baseUrl}/api/trips/${env.tripId}/expenses`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${env.session.token}`,
      },
      body: JSON.stringify(payload),
    });
    assert.equal(saveRes.status, 201);
    const savedData = await saveRes.json();
    assert.equal(savedData.totalPaise, 300000);

    // 3. Verify saved expense from GET endpoint
    const expRes = await fetch(`${baseUrl}/api/trips/${env.tripId}/expenses/${savedData.id}`, {
      headers: { Authorization: `Bearer ${env.session.token}` },
    });
    assert.equal(expRes.status, 200);
    const expDetail = await expRes.json();
    assert.equal(expDetail.split_method, 'individual_remainder');
    assert.equal(expDetail.total_paise, 300000);

    const savedMap = Object.fromEntries(expDetail.allocations.map((a: any) => [`p:${a.account_id}`, a.amount_paise]));
    assert.deepEqual(savedMap, {
      [`p:${p1}`]: 70000,
      [`p:${p2}`]: 90000,
      [`p:${p3}`]: 40000,
      [`p:${p4}`]: 60000,
      [`p:${p5}`]: 40000,
    });

    // Preview and saved allocations agree 100%
    assert.deepEqual(prevMap, savedMap);

    // Unselected participants (P6..P10) are charged ₹0
    for (let i = 5; i < env.persons.length; i++) {
      assert.equal(expDetail.allocations.find((a: any) => a.account_id === env.persons[i].id), undefined);
    }

    // 4. Test payer separate from participants (e.g. Person 10 pays for P2..P5)
    const separatePayerPayload = {
      title: 'Activity Fee',
      expense_date: '2026-10-25',
      category: 'Activities',
      paid_by_type: 'person',
      paid_by_id: env.persons[9].id, // Person 10 paid
      accounting_mode: 'individual',
      split_method: 'individual_remainder',
      total_paise: 100000, // ₹1,000
      individual_remainder_entries: [
        { id: `p:${p2}`, individual_amount_paise: 20000 }, // ₹200
        { id: `p:${p3}`, individual_amount_paise: 0 },     // ₹0
      ],
    };
    const sepRes = await fetch(`${baseUrl}/api/trips/${env.tripId}/expenses/preview`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${env.session.token}`,
      },
      body: JSON.stringify(separatePayerPayload),
    });
    assert.equal(sepRes.status, 200);
    const sepData = await sepRes.json();
    // Remainder = 1000 - 200 = 800 -> 400 each to P2 and P3. Payer Person 10 owes 0!
    assert.equal(sepData.summary.payerOwnShare, 0);
    assert.equal(sepData.summary.recoverable, 100000);
    const sepMap = Object.fromEntries(sepData.allocations.map((a: any) => [a.id, a.amount]));
    assert.deepEqual(sepMap, {
      [`p:${p2}`]: 60000, // 200 + 400 = 600
      [`p:${p3}`]: 40000, // 0 + 400 = 400
    });

    // 5. Test rejection: individual portions exceed total expense
    const exceedPayload = {
      ...payload,
      total_paise: 200000, // ₹2,000 total, but portions sum to ₹1,000 + ₹2,000 = ₹3,000
      individual_remainder_entries: [
        { id: `p:${p1}`, individual_amount_paise: 150000 },
        { id: `p:${p2}`, individual_amount_paise: 100000 },
      ],
    };
    const exceedRes = await fetch(`${baseUrl}/api/trips/${env.tripId}/expenses`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${env.session.token}`,
      },
      body: JSON.stringify(exceedPayload),
    });
    assert.equal(exceedRes.status, 400);

    // 6. Test rejection: empty participants
    const emptyPayload = {
      ...payload,
      individual_remainder_entries: [],
      participant_keys: [],
    };
    const emptyRes = await fetch(`${baseUrl}/api/trips/${env.tripId}/expenses`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${env.session.token}`,
      },
      body: JSON.stringify(emptyPayload),
    });
    assert.equal(emptyRes.status, 400);
  } finally {
    server.close();
  }
});
