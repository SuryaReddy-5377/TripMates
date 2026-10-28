import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  FinanceError, parseRupees, formatINR, allocateByWeights, sumAmounts,
  equalSplit, perHeadSplit, customSplit, percentageSplit, splitFamilyShare, mixedSplit, individualRemainderSplit, personKey, familyKey,
  computeItemizedBill, computeBalances, assertReconciled, totalNet, summarizeExpense,
  validateRepayment, suggestSettlements, settlementStatus, type Expense, type Repayment,
} from '../src/finance';

const R = (n: number) => n * 100; // rupees -> paise
const code = (c: string) => (e: unknown) => e instanceof FinanceError && e.code === c;
const by = (a: { id: string; amount: number }[]) => Object.fromEntries(a.map(x => [x.id, x.amount]));

test('money: parsing and Indian formatting', () => {
  assert.equal(parseRupees('50'), 5000);
  assert.equal(parseRupees('1250.5'), 125050);
  assert.throws(() => parseRupees('-5'), code('BAD_AMOUNT'));
  assert.equal(formatINR(R(1000)), '₹1,000');
  assert.equal(formatINR(12500050), '₹1,25,000.50');
});

test('equal split: ₹1,200 among four = ₹300 each', () => {
  assert.deepEqual(equalSplit(R(1200), ['a', 'b', 'c', 'd']).map(x => x.amount), [R(300), R(300), R(300), R(300)]);
});

test('rounding: remainder is distributed deterministically and always reconciles', () => {
  const a = equalSplit(1000, ['c', 'a', 'b']); // ₹10.00 / 3
  assert.equal(sumAmounts(a), 1000);
  assert.deepEqual(by(a), { a: 334, b: 333, c: 333 }); // tie -> lowest id first, independent of selection order
  assert.deepEqual(by(equalSplit(1000, ['a', 'b', 'c'])), by(a));
  for (let n = 1; n <= 13; n++) for (const t of [1, 7, 99, 100, 10001, 123457]) {
    const ids = Array.from({ length: n }, (_, i) => `x${i}`);
    assert.equal(sumAmounts(equalSplit(t, ids)), t);
  }
  assert.deepEqual(allocateByWeights(100, [1, 1, 1]), [34, 33, 33]);
});

test('equal split rejects empty and duplicate selections', () => {
  assert.throws(() => equalSplit(100, []), code('NO_PARTICIPANTS'));
  assert.throws(() => equalSplit(100, ['a', 'a']), code('DUPLICATE_PARTICIPANT'));
});

test('per-head: six people at ₹150 = ₹900', () => {
  const r = perHeadSplit(R(150), ['a', 'b', 'c', 'd', 'e', 'f'].map(id => ({ id, heads: 1 })));
  assert.equal(r.total, R(900));
  const fam = perHeadSplit(R(150), [{ id: 'f:1', heads: 4 }, { id: 'p:9', heads: 1 }]);
  assert.deepEqual(by(fam.allocations), { 'f:1': R(600), 'p:9': R(150) });
  assert.throws(() => perHeadSplit(R(150), [{ id: 'a', heads: 0 }]), code('BAD_QUANTITY'));
});

test('custom / individual split: must match total exactly', () => {
  assert.deepEqual(by(customSplit(R(1000), [{ id: 'a', amount: R(700) }, { id: 'b', amount: R(300) }])), { a: R(700), b: R(300) });
  assert.throws(() => customSplit(R(1000), [{ id: 'a', amount: R(700) }, { id: 'b', amount: R(200) }]), code('TOTAL_MISMATCH'));
  assert.throws(() => customSplit(R(1000), [{ id: 'a', amount: -5 }, { id: 'b', amount: R(1000) + 5 }]), code('NEGATIVE'));
});

test('percentage split: 50/30/20 and rounding; rejects ≠100%', () => {
  assert.deepEqual(by(percentageSplit(R(1000), [{ id: 'a', bps: 5000 }, { id: 'b', bps: 3000 }, { id: 'c', bps: 2000 }])), { a: R(500), b: R(300), c: R(200) });
  const odd = percentageSplit(1001, [{ id: 'a', bps: 3333 }, { id: 'b', bps: 3333 }, { id: 'c', bps: 3334 }]);
  assert.equal(sumAmounts(odd), 1001);
  assert.throws(() => percentageSplit(R(100), [{ id: 'a', bps: 5000 }, { id: 'b', bps: 4000 }]), code('PERCENT_TOTAL'));
});

test('individual amount + equal shared remainder: ₹3,000 example (portions: 300, 500, 0, 200, 0)', () => {
  const result = individualRemainderSplit(R(3000), [
    { id: 'p1', individualAmount: R(300) },
    { id: 'p2', individualAmount: R(500) },
    { id: 'p3', individualAmount: R(0) },
    { id: 'p4', individualAmount: R(200) },
    { id: 'p5', individualAmount: R(0) },
  ]);

  assert.equal(result.individualTotal, R(1000));
  assert.equal(result.sharedRemainder, R(2000));
  assert.deepEqual(by(result.allocations), {
    p1: R(700),
    p2: R(900),
    p3: R(400),
    p4: R(600),
    p5: R(400),
  });
  assert.equal(sumAmounts(result.allocations), R(3000));
});

test('individual amount + equal shared remainder: rounding with uneven remainder & edge cases', () => {
  // Uneven remainder: total ₹100.01 (10001 paise), individual portions ₹10, ₹0, ₹0
  // Remainder = 9001 paise among 3 -> 3000, 3000, 3000 with 1 leftover paisa to lowest id ('a')
  const uneven = individualRemainderSplit(10001, [
    { id: 'b', individualAmount: 0 },
    { id: 'a', individualAmount: 1000 },
    { id: 'c', individualAmount: 0 },
  ]);
  assert.equal(uneven.individualTotal, 1000);
  assert.equal(uneven.sharedRemainder, 9001);
  assert.equal(sumAmounts(uneven.allocations), 10001);
  assert.deepEqual(by(uneven.allocations), {
    a: 1000 + 3001, // 4001
    b: 3000,
    c: 3000,
  });

  // Zero individual portions (pure equal split behavior)
  const zeroAll = individualRemainderSplit(R(600), [
    { id: 'a', individualAmount: 0 },
    { id: 'b', individualAmount: 0 },
  ]);
  assert.equal(zeroAll.individualTotal, 0);
  assert.equal(zeroAll.sharedRemainder, R(600));
  assert.deepEqual(by(zeroAll.allocations), { a: R(300), b: R(300) });

  // Individual amounts sum exactly to total (shared remainder is 0)
  const exact = individualRemainderSplit(R(500), [
    { id: 'a', individualAmount: R(200) },
    { id: 'b', individualAmount: R(300) },
  ]);
  assert.equal(exact.individualTotal, R(500));
  assert.equal(exact.sharedRemainder, 0);
  assert.deepEqual(by(exact.allocations), { a: R(200), b: R(300) });

  // Validation: individual total exceeds total expense
  assert.throws(
    () => individualRemainderSplit(R(100), [{ id: 'a', individualAmount: R(80) }, { id: 'b', individualAmount: R(30) }]),
    code('INDIVIDUAL_EXCEEDS_TOTAL')
  );

  // Validation: negative individual amount
  assert.throws(
    () => individualRemainderSplit(R(100), [{ id: 'a', individualAmount: -50 }]),
    code('NEGATIVE')
  );

  // Validation: empty participants
  assert.throws(
    () => individualRemainderSplit(R(100), []),
    code('NO_PARTICIPANTS')
  );

  // Validation: duplicate participants
  assert.throws(
    () => individualRemainderSplit(R(100), [{ id: 'a', individualAmount: 10 }, { id: 'a', individualAmount: 20 }]),
    code('DUPLICATE_PARTICIPANT')
  );
});

test('family-wise split: family share broken down among members without double-charging', () => {
  const m = splitFamilyShare(R(1000), ['m1', 'm2', 'm3', 'm4']);
  assert.deepEqual(m.map(x => x.amount), [R(250), R(250), R(250), R(250)]);
  assert.equal(sumAmounts(m), R(1000));
  const c = splitFamilyShare(R(1000), [], [{ id: 'm1', amount: R(600) }, { id: 'm2', amount: R(400) }]);
  assert.equal(sumAmounts(c), R(1000));
  assert.throws(() => splitFamilyShare(R(1000), [], [{ id: 'm1', amount: R(600) }]), code('TOTAL_MISMATCH'));
});

test('mixed mode: one family + two individuals; family owes once, not per member', () => {
  const res = mixedSplit(R(2000), [
    { type: 'family', id: '1', amount: R(1000), members: { ids: ['m1', 'm2', 'm3', 'm4'] } },
    { type: 'person', id: '8', amount: R(600) },
    { type: 'person', id: '9', amount: R(400) },
  ]);
  assert.deepEqual(by(res.allocations), { [familyKey('1')]: R(1000), [personKey('8')]: R(600), [personKey('9')]: R(400) });
  assert.equal(sumAmounts(res.allocations), R(2000));                       // family counted once
  assert.equal(sumAmounts(res.memberBreakdown[familyKey('1')]), R(1000));    // breakdown reconciles to family share
  assert.throws(() => mixedSplit(R(2000), [{ type: 'person', id: '8', amount: R(1999) }]), code('TOTAL_MISMATCH'));
  assert.throws(() => mixedSplit(R(100), [{ type: 'person', id: '8', amount: R(50) }, { type: 'person', id: '8', amount: R(50) }]), code('DUPLICATE_PARTICIPANT'));
});

// ---- Mandatory acceptance test #1: idly & puri ----
test('ACCEPTANCE: idly (3×₹50) and puri (4×₹80) among seven people', () => {
  const idly = ['p1', 'p2', 'p3'], puri = ['p4', 'p5', 'p6', 'p7'];
  const bill = computeItemizedBill({
    items: [
      { name: 'Idly', unitPrice: R(50), quantity: 3, assignees: idly },
      { name: 'Puri', unitPrice: R(80), quantity: 4, assignees: puri },
    ],
  });
  assert.equal(bill.itemSubtotals[0].subtotal, R(150));
  assert.equal(bill.itemSubtotals[1].subtotal, R(320));
  assert.equal(bill.total, R(470));
  const owed = by(bill.allocations);
  for (const p of idly) assert.equal(owed[p], R(50));
  for (const p of puri) assert.equal(owed[p], R(80));
  assert.equal(bill.allocations.length, 7);
  assert.equal(owed['p8'], undefined); // an eighth, unselected person owes nothing
  assert.equal(sumAmounts(bill.allocations), R(470));
});

test('itemized: shared ₹200 dish among four = ₹50 each; others untouched', () => {
  const bill = computeItemizedBill({ items: [{ name: 'Paneer', unitPrice: R(200), quantity: 1, assignees: ['a', 'b', 'c', 'd'] }] });
  assert.deepEqual(bill.allocations.map(x => x.amount), [R(50), R(50), R(50), R(50)]);
});

test('itemized: per-person quantity weights and custom amounts', () => {
  const w = computeItemizedBill({ items: [{ name: 'Dosa', unitPrice: R(60), quantity: 3, assignees: ['a', 'b'], method: 'byQuantity', weights: { a: 2, b: 1 } }] });
  assert.deepEqual(by(w.allocations), { a: R(120), b: R(60) });
  const c = computeItemizedBill({ items: [{ name: 'Thali', unitPrice: R(100), quantity: 2, assignees: ['a', 'b'], method: 'custom', customAmounts: { a: R(150), b: R(50) } }] });
  assert.deepEqual(by(c.allocations), { a: R(150), b: R(50) });
  assert.throws(() => computeItemizedBill({ items: [{ name: 'Thali', unitPrice: R(100), quantity: 2, assignees: ['a', 'b'], method: 'custom', customAmounts: { a: R(150), b: R(40) } }] }), code('TOTAL_MISMATCH'));
});

test('itemized: item allocated to a family account', () => {
  const bill = computeItemizedBill({ items: [{ name: 'Biryani', unitPrice: R(300), quantity: 4, assignees: ['f:1'] }, { name: 'Lassi', unitPrice: R(70), quantity: 1, assignees: ['p:2'] }] });
  assert.deepEqual(by(bill.allocations), { 'f:1': R(1200), 'p:2': R(70) });
});

test('itemized: tax and service charge are pro-rata and only hit people with items', () => {
  const bill = computeItemizedBill({
    items: [
      { name: 'Idly', unitPrice: R(50), quantity: 3, assignees: ['a', 'b', 'c'] },
      { name: 'Puri', unitPrice: R(80), quantity: 4, assignees: ['d', 'e', 'f', 'g'] },
    ],
    charges: [{ kind: 'tax', amount: R(47) }], // 10% of 470
    receiptTotal: R(517),
  });
  assert.equal(bill.total, R(517));
  assert.deepEqual(bill.warnings, []);
  const o = by(bill.allocations);
  assert.equal(o.a, R(55)); // 50 + 10%
  assert.equal(o.d, R(88)); // 80 + 10%
  assert.equal(sumAmounts(bill.allocations), R(517));
});

test('itemized: discount reduces shares; charge limited to selected people (equal)', () => {
  const d = computeItemizedBill({
    items: [{ name: 'Lunch', unitPrice: R(100), quantity: 4, assignees: ['a', 'b', 'c', 'd'] }],
    charges: [{ kind: 'discount', amount: R(40) }],
  });
  assert.equal(d.total, R(360));
  assert.deepEqual(d.allocations.map(x => x.amount), [R(90), R(90), R(90), R(90)]);
  const s = computeItemizedBill({
    items: [{ name: 'Lunch', unitPrice: R(100), quantity: 4, assignees: ['a', 'b', 'c', 'd'] }],
    charges: [{ kind: 'service', amount: R(20), allocation: { method: 'equal', ids: ['a', 'b'] } }],
  });
  assert.deepEqual(by(s.allocations), { a: R(110), b: R(110), c: R(100), d: R(100) });
  const adj = computeItemizedBill({ items: [{ name: 'X', unitPrice: R(100), quantity: 1, assignees: ['a'] }], charges: [{ kind: 'adjustment', amount: R(5), direction: 'subtract' }] });
  assert.equal(adj.total, R(95));
});

test('itemized: tax rounding reconciles to the paisa', () => {
  const bill = computeItemizedBill({
    items: [{ name: 'A', unitPrice: 3333, quantity: 1, assignees: ['a'] }, { name: 'B', unitPrice: 3333, quantity: 1, assignees: ['b'] }, { name: 'C', unitPrice: 3334, quantity: 1, assignees: ['c'] }],
    charges: [{ kind: 'tax', amount: 1001 }],
  });
  assert.equal(sumAmounts(bill.allocations), 10000 + 1001);
});

test('itemized: receipt mismatch is a warning, never silently "fixed"', () => {
  const bill = computeItemizedBill({ items: [{ name: 'Idly', unitPrice: R(50), quantity: 3, assignees: ['a', 'b', 'c'] }], receiptTotal: R(160) });
  assert.equal(bill.total, R(150));
  assert.equal(bill.warnings.length, 1);
  assert.equal(bill.warnings[0].code, 'RECEIPT_MISMATCH');
  assert.equal(bill.warnings[0].difference, -R(10));
});

test('itemized: validation errors', () => {
  const item = (o = {}) => ({ name: 'I', unitPrice: R(10), quantity: 1, assignees: ['a'], ...o });
  assert.throws(() => computeItemizedBill({ items: [] }), code('NO_ITEMS'));
  assert.throws(() => computeItemizedBill({ items: [item({ unitPrice: -1 })] }), code('NEGATIVE'));
  assert.throws(() => computeItemizedBill({ items: [item({ quantity: 0 })] }), code('BAD_QUANTITY'));
  assert.throws(() => computeItemizedBill({ items: [item({ quantity: 1.5 })] }), code('BAD_QUANTITY'));
  assert.throws(() => computeItemizedBill({ items: [item({ assignees: [] })] }), code('ITEM_NO_ASSIGNEES'));
  assert.throws(() => computeItemizedBill({ items: [item()], charges: [{ kind: 'discount', amount: R(50) }] }), code('NEGATIVE_SHARE'));
});

// ---- Mandatory acceptance test #2: ₹3,000 lunch, 6 of 10 ----
const tenPeople = Array.from({ length: 10 }, (_, i) => personKey(`m${i + 1}`));
const surya = tenPeople[0];

test('ACCEPTANCE: ₹3,000 lunch paid by Surya, equally shared by six of ten (payer included)', () => {
  const six = tenPeople.slice(0, 6);
  const exp: Expense = { id: 'lunch', paidBy: surya, total: R(3000), allocations: equalSplit(R(3000), six) };
  for (const a of exp.allocations) assert.equal(a.amount, R(500));
  const s = summarizeExpense(exp);
  assert.equal(s.payerOwnShare, R(500));
  assert.equal(s.recoverable, R(2500));
  const b = computeBalances([exp]);
  assert.equal(b[surya].net, R(2500));                   // others collectively owe Surya ₹2,500
  for (const p of six.slice(1)) assert.equal(b[p].net, -R(500));
  for (const p of tenPeople.slice(6)) assert.equal(b[p], undefined); // four unselected owe nothing
  assert.equal(totalNet(b), 0);
});

test('payer NOT in the split: payer is not charged merely for paying', () => {
  const exp: Expense = { id: 'e', paidBy: surya, total: R(3000), allocations: equalSplit(R(3000), tenPeople.slice(1, 7)) };
  const s = summarizeExpense(exp);
  assert.equal(s.payerOwnShare, 0);
  assert.equal(s.recoverable, R(3000));
  const b = computeBalances([exp]);
  assert.equal(b[surya].share, 0);
  assert.equal(b[surya].net, R(3000));
  assertReconciled(b);
});

test('expense validation: allocations must reconcile; unselected / declined accounts never auto-charged', () => {
  assert.throws(() => computeBalances([{ id: 'x', paidBy: 'a', total: R(100), allocations: [{ id: 'b', amount: R(90) }] }]), code('TOTAL_MISMATCH'));
  assert.throws(() => computeBalances([{ id: 'x', paidBy: 'a', total: R(100), allocations: [] }]), code('NO_ALLOCATIONS'));
});

test('another person / a family pays the bill', () => {
  const e: Expense = { id: 'e', paidBy: familyKey('1'), total: R(1000), allocations: equalSplit(R(1000), [familyKey('1'), personKey('9')]) };
  const b = computeBalances([e]);
  assert.equal(b['f:1'].net, R(500));
  assert.equal(b['p:9'].net, -R(500));
  assertReconciled(b);
});

test('multi-expense ledger across payers reconciles to zero', () => {
  const ids = ['a', 'b', 'c', 'd'];
  const exps: Expense[] = [
    { id: '1', paidBy: 'a', total: R(1000), allocations: equalSplit(R(1000), ids) },
    { id: '2', paidBy: 'b', total: 33333, allocations: equalSplit(33333, ['a', 'b', 'c']) },
    { id: '3', paidBy: 'c', total: R(470), allocations: computeItemizedBill({ items: [{ name: 'I', unitPrice: R(50), quantity: 3, assignees: ['a', 'b', 'c'] }, { name: 'P', unitPrice: R(80), quantity: 4, assignees: ['d', 'a', 'b', 'c'] }] }).allocations },
  ];
  assert.equal(totalNet(computeBalances(exps)), 0);
});

test('repayments: partial, multiple, complete; repayment is not an expense', () => {
  const six = tenPeople.slice(0, 6);
  const exp: Expense = { id: 'lunch', paidBy: surya, total: R(3000), allocations: equalSplit(R(3000), six) };
  const reps: Repayment[] = [];
  let bal = computeBalances([exp], reps);
  const m2 = tenPeople[1];
  const r1: Repayment = { id: 'r1', from: m2, to: surya, amount: R(200), date: '2026-10-01' };
  validateRepayment(bal, reps, r1); reps.push(r1);
  bal = computeBalances([exp], reps);
  assert.equal(bal[m2].net, -R(300));            // partial
  assert.equal(bal[surya].net, R(2300));
  const r2: Repayment = { id: 'r2', from: m2, to: surya, amount: R(300), date: '2026-10-02' };
  validateRepayment(bal, reps, r2); reps.push(r2);
  bal = computeBalances([exp], reps);
  assert.equal(bal[m2].net, 0);                  // complete
  assert.equal(bal[surya].net, R(2000));
  assert.equal(totalNet(bal), 0);
  assert.equal(bal[surya].paid, R(3000));        // totals unchanged: repayment did not alter spending
  assert.equal(settlementStatus(bal), 'unsettled');
  for (const p of six.slice(2)) { const r: Repayment = { id: p, from: p, to: surya, amount: R(500), date: '2026-10-03' }; validateRepayment(bal, reps, r); reps.push(r); bal = computeBalances([exp], reps); }
  assert.equal(settlementStatus(bal), 'settled');
});

test('repayments: duplicate prevention, overpayment and invalid input rejected', () => {
  const exp: Expense = { id: 'e', paidBy: 'a', total: R(1000), allocations: equalSplit(R(1000), ['a', 'b']) };
  const r1: Repayment = { id: 'r1', from: 'b', to: 'a', amount: R(100), date: '2026-10-01', reference: 'UPI123', idempotencyKey: 'k1' };
  let bal = computeBalances([exp]);
  validateRepayment(bal, [], r1);
  const existing = [r1];
  bal = computeBalances([exp], existing);
  assert.throws(() => validateRepayment(bal, existing, { ...r1, id: 'r2' }), code('DUPLICATE_REPAYMENT'));                              // same idempotency key
  assert.throws(() => validateRepayment(bal, existing, { ...r1, id: 'r2', idempotencyKey: undefined }), code('DUPLICATE_REPAYMENT'));   // same fields
  validateRepayment(bal, existing, { ...r1, id: 'r3', idempotencyKey: undefined, reference: 'UPI124' });                                // different reference is allowed
  assert.throws(() => validateRepayment(bal, existing, { id: 'r4', from: 'b', to: 'a', amount: R(401), date: '2026-10-02' }), code('EXCEEDS_DEBT'));
  validateRepayment(bal, existing, { id: 'r5', from: 'b', to: 'a', amount: R(401), date: '2026-10-02' }, { allowAdvance: true });       // explicit advance
  assert.throws(() => validateRepayment(bal, existing, { id: 'r6', from: 'a', to: 'a', amount: 1, date: 'd' }), code('SAME_ACCOUNT'));
  assert.throws(() => validateRepayment(bal, existing, { id: 'r7', from: 'b', to: 'a', amount: 0, date: 'd' }), code('ZERO'));
  assert.throws(() => validateRepayment(bal, existing, { id: 'r8', from: 'b', to: 'a', amount: -5, date: 'd' }), code('NEGATIVE'));
  assert.throws(() => validateRepayment(bal, existing, { id: 'r9', from: 'a', to: 'b', amount: R(10), date: 'd' }), code('EXCEEDS_DEBT'));   // a is owed, doesn't owe
});

test('someone else covers a share: expense untouched, debt moves, nothing counted twice', () => {
  const exp: Expense = { id: 'e', paidBy: 'a', total: R(900), allocations: equalSplit(R(900), ['a', 'b', 'c']) };
  const b = computeBalances([exp], [], [{ id: 'd1', debtor: 'c', assumedBy: 'b', amount: R(300) }]);
  assert.equal(b['c'].net, 0);
  assert.equal(b['b'].net, -R(600));
  assert.equal(b['a'].net, R(600));
  assert.equal(b['a'].paid, R(900)); // underlying expense preserved
  assertReconciled(b);
});

test('settlement suggestions clear every balance and are deterministic', () => {
  const exps: Expense[] = [
    { id: '1', paidBy: 'a', total: R(1000), allocations: equalSplit(R(1000), ['a', 'b', 'c', 'd']) },
    { id: '2', paidBy: 'b', total: R(600), allocations: equalSplit(R(600), ['a', 'b', 'c']) },
  ];
  const bal = computeBalances(exps);
  const t = suggestSettlements(bal);
  assert.deepEqual(suggestSettlements(bal), t);
  const reps: Repayment[] = t.map((x, i) => ({ id: `s${i}`, ...x, date: '2026-10-05' }));
  const after = computeBalances(exps, reps);
  assert.ok(Object.values(after).every(x => x.net === 0));
  assert.equal(settlementStatus(after), 'settled');
});

test('history is stable: later changes elsewhere do not alter saved allocations', () => {
  const saved = equalSplit(R(1200), ['a', 'b', 'c']);
  const snapshot = JSON.stringify(saved);
  equalSplit(R(1200), ['a', 'b', 'c', 'd']); // a later, different calculation
  assert.equal(JSON.stringify(saved), snapshot);
});
