import { Allocation, FinanceError, Paise, assertPaise, sumAmounts, formatINR } from './money';

/**
 * Convention (used everywhere):
 *   net = paid on behalf of group − assigned shares + repayments SENT − repayments RECEIVED
 *   (NOTE: the original brief wrote "− sent + received". That sign is inverted: a debtor who repays
 *    would become MORE negative. Sending money reduces what you owe, so it must INCREASE net.
 *    The corrected form below is the one that satisfies "positive = receives, negative = owes,
 *    sum of all nets = 0" and is covered by the tests.)
 *   net > 0  → account should RECEIVE money
 *   net < 0  → account OWES money
 *   net = 0  → settled
 * Accounts are opaque keys such as "p:7" (person) or "f:2" (family).
 */
export interface Expense {
  id: string;
  paidBy: string;            // account that paid the merchant
  total: Paise;              // amount paid to the merchant
  allocations: Allocation[]; // who is responsible; must sum to total
}

export interface Repayment {
  id: string;
  from: string;
  to: string;
  amount: Paise;
  date: string;              // ISO date
  reference?: string;
  idempotencyKey?: string;
}

/** Someone agrees to carry another account's debt (no cash moves). Expense is untouched. */
export interface DebtAssumption {
  id: string;
  debtor: string;
  assumedBy: string;
  amount: Paise;
}

export interface Balance { paid: Paise; share: Paise; sent: Paise; received: Paise; assumedCredit: Paise; assumedDebit: Paise; net: Paise }

export function validateExpense(e: Expense): void {
  assertPaise(e.total, 'expense total', { allowZero: false });
  if (e.allocations.length === 0) throw new FinanceError('NO_ALLOCATIONS', 'An expense needs at least one responsible account');
  if (new Set(e.allocations.map(a => a.id)).size !== e.allocations.length)
    throw new FinanceError('DUPLICATE_PARTICIPANT', 'An account appears twice in the same expense');
  e.allocations.forEach(a => assertPaise(a.amount, 'share'));
  const s = sumAmounts(e.allocations);
  if (s !== e.total) throw new FinanceError('TOTAL_MISMATCH', `Shares add up to ${formatINR(s)} but the expense is ${formatINR(e.total)}`);
}

export interface ExpenseSummary {
  paidBy: string;
  total: Paise;
  payerOwnShare: Paise;      // 0 when the payer is not part of the split
  recoverable: Paise;        // amount owed to the payer by the other accounts
  chargedAccounts: string[]; // everyone who owes something for this expense
}

/** "Paid by Surya ₹3,000 · own share ₹500 · recoverable ₹2,500", from the saved allocations. */
export function summarizeExpense(e: Expense): ExpenseSummary {
  validateExpense(e);
  const own = e.allocations.find(a => a.id === e.paidBy)?.amount ?? 0;
  return {
    paidBy: e.paidBy, total: e.total, payerOwnShare: own, recoverable: e.total - own,
    chargedAccounts: e.allocations.filter(a => a.amount > 0).map(a => a.id),
  };
}

export function computeBalances(
  expenses: Expense[], repayments: Repayment[] = [], assumptions: DebtAssumption[] = [],
): Record<string, Balance> {
  const out: Record<string, Balance> = {};
  const get = (id: string): Balance =>
    (out[id] ??= { paid: 0, share: 0, sent: 0, received: 0, assumedCredit: 0, assumedDebit: 0, net: 0 });
  for (const e of expenses) {
    validateExpense(e);
    get(e.paidBy).paid += e.total;
    for (const a of e.allocations) get(a.id).share += a.amount;
  }
  for (const r of repayments) { get(r.from).sent += r.amount; get(r.to).received += r.amount; }
  for (const d of assumptions) { get(d.debtor).assumedCredit += d.amount; get(d.assumedBy).assumedDebit += d.amount; }
  for (const b of Object.values(out)) b.net = b.paid - b.share + b.sent - b.received + b.assumedCredit - b.assumedDebit;
  return out;
}

/** Invariant: for a fully accounted group the nets sum to exactly zero. */
export function totalNet(balances: Record<string, Balance>): Paise {
  return Object.values(balances).reduce((a, b) => a + b.net, 0);
}

export function assertReconciled(balances: Record<string, Balance>): void {
  const t = totalNet(balances);
  if (t !== 0) throw new FinanceError('UNRECONCILED', `Balances do not add up to zero (off by ${formatINR(t)})`);
}

export function duplicateKey(r: Pick<Repayment, 'from' | 'to' | 'amount' | 'date' | 'reference'>): string {
  return [r.from, r.to, r.amount, r.date, (r.reference ?? '').trim().toLowerCase()].join('|');
}

/**
 * Validate a new repayment against current state.
 * - rejects same-account, zero/negative amounts
 * - rejects exact duplicates (same idempotencyKey, or same from/to/amount/date/reference)
 * - rejects amounts above what the sender owes or the recipient is owed,
 *   unless `allowAdvance` (an explicit, authorized advance) is set.
 */
export function validateRepayment(
  current: Record<string, Balance>, existing: Repayment[], r: Repayment, opts: { allowAdvance?: boolean } = {},
): void {
  assertPaise(r.amount, 'repayment', { allowZero: false });
  if (r.from === r.to) throw new FinanceError('SAME_ACCOUNT', 'Sender and recipient must be different');
  if (r.idempotencyKey && existing.some(x => x.idempotencyKey === r.idempotencyKey))
    throw new FinanceError('DUPLICATE_REPAYMENT', 'This repayment was already recorded');
  if (existing.some(x => duplicateKey(x) === duplicateKey(r)))
    throw new FinanceError('DUPLICATE_REPAYMENT', 'An identical repayment (same people, amount, date and reference) already exists');
  if (opts.allowAdvance) return;
  const owed = Math.max(0, -(current[r.from]?.net ?? 0));
  const due = Math.max(0, current[r.to]?.net ?? 0);
  if (r.amount > owed) throw new FinanceError('EXCEEDS_DEBT', `Sender only owes ${formatINR(owed)}; ${formatINR(r.amount)} is too much`);
  if (r.amount > due) throw new FinanceError('EXCEEDS_RECEIVABLE', `Recipient is only owed ${formatINR(due)}; ${formatINR(r.amount)} is too much`);
}

export interface SuggestedTransfer { from: string; to: string; amount: Paise }

/** Deterministic, minimal-ish settlement: largest debtor pays largest creditor first. */
export function suggestSettlements(balances: Record<string, Balance>): SuggestedTransfer[] {
  const byAmountThenId = (a: [string, number], b: [string, number]) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1);
  const debtors = Object.entries(balances).filter(([, b]) => b.net < 0).map(([id, b]) => [id, -b.net] as [string, number]).sort(byAmountThenId);
  const creditors = Object.entries(balances).filter(([, b]) => b.net > 0).map(([id, b]) => [id, b.net] as [string, number]).sort(byAmountThenId);
  const out: SuggestedTransfer[] = [];
  let i = 0, j = 0;
  while (i < debtors.length && j < creditors.length) {
    const amt = Math.min(debtors[i][1], creditors[j][1]);
    out.push({ from: debtors[i][0], to: creditors[j][0], amount: amt });
    debtors[i][1] -= amt; creditors[j][1] -= amt;
    if (debtors[i][1] === 0) i++;
    if (creditors[j][1] === 0) j++;
  }
  return out;
}

export function settlementStatus(balances: Record<string, Balance>): 'settled' | 'unsettled' {
  return Object.values(balances).every(b => b.net === 0) ? 'settled' : 'unsettled';
}
