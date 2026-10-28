import { Allocation, FinanceError, Paise, allocateByWeights, assertPaise, assertQuantity, sumAmounts, formatINR } from './money';

/** Account keys keep people and families distinct: "p:<id>" or "f:<id>". */
export const personKey = (id: string | number) => `p:${id}`;
export const familyKey = (id: string | number) => `f:${id}`;

function uniqueIds(ids: string[]): void {
  if (ids.length === 0) throw new FinanceError('NO_PARTICIPANTS', 'Select at least one participant');
  if (new Set(ids).size !== ids.length) throw new FinanceError('DUPLICATE_PARTICIPANT', 'A participant was selected twice');
}

function mustEqual(total: Paise, got: Paise, what: string): void {
  if (total !== got) {
    const diff = got - total;
    throw new FinanceError('TOTAL_MISMATCH',
      `${what} add up to ${formatINR(got)} but the bill is ${formatINR(total)} (${diff > 0 ? 'over' : 'short'} by ${formatINR(Math.abs(diff))})`);
  }
}

/** A. Equal split among the selected accounts. */
export function equalSplit(total: Paise, ids: string[]): Allocation[] {
  uniqueIds(ids);
  const amts = allocateByWeights(total, ids.map(() => 1), ids);
  return ids.map((id, i) => ({ id, amount: amts[i] }));
}

/** B. Per-head: a rate times a head-count for each account. The total is derived. */
export function perHeadSplit(rate: Paise, entries: { id: string; heads: number }[]): { total: Paise; allocations: Allocation[] } {
  assertPaise(rate, 'rate', { allowZero: false });
  uniqueIds(entries.map(e => e.id));
  entries.forEach(e => assertQuantity(e.heads, 'heads'));
  const allocations = entries.map(e => ({ id: e.id, amount: rate * e.heads }));
  return { total: sumAmounts(allocations), allocations };
}

/** D / F. Exact amount for each account; must sum to the total. */
export function customSplit(total: Paise, entries: Allocation[]): Allocation[] {
  uniqueIds(entries.map(e => e.id));
  entries.forEach(e => assertPaise(e.amount, 'share'));
  mustEqual(total, sumAmounts(entries), 'The shares');
  return entries.map(e => ({ ...e }));
}

/** G. Percentage split. Percentages are in basis points (25.5% = 2550); must sum to 10000. */
export function percentageSplit(total: Paise, entries: { id: string; bps: number }[]): Allocation[] {
  uniqueIds(entries.map(e => e.id));
  entries.forEach(e => {
    if (!Number.isSafeInteger(e.bps) || e.bps < 0) throw new FinanceError('BAD_PERCENT', 'Percentages must be zero or more');
  });
  const totalBps = entries.reduce((a, e) => a + e.bps, 0);
  if (totalBps !== 10000) throw new FinanceError('PERCENT_TOTAL', `Percentages add up to ${totalBps / 100}% instead of 100%`);
  const amts = allocateByWeights(total, entries.map(e => e.bps), entries.map(e => e.id));
  return entries.map((e, i) => ({ id: e.id, amount: amts[i] }));
}

export interface IndividualRemainderEntry {
  id: string;
  individualAmount: Paise;
}

export interface IndividualRemainderResult {
  individualTotal: Paise;
  sharedRemainder: Paise;
  allocations: Allocation[];
}

/**
 * Individual Amount + Equal Shared Remainder:
 * - Individual total = sum of entered individual portions.
 * - Shared remainder = total expense - individual total.
 * - Divide shared remainder equally among all selected participants (deterministic integer paise).
 * - Final member share = individual portion + equal remainder share.
 */
export function individualRemainderSplit(
  total: Paise,
  entries: IndividualRemainderEntry[]
): IndividualRemainderResult {
  assertPaise(total, 'total', { allowZero: false });
  uniqueIds(entries.map(e => e.id));
  entries.forEach(e => assertPaise(e.individualAmount, 'individual portion'));

  const individualTotal = entries.reduce((acc, e) => acc + e.individualAmount, 0);
  if (individualTotal > total) {
    throw new FinanceError(
      'INDIVIDUAL_EXCEEDS_TOTAL',
      `Individual portions total ${formatINR(individualTotal)} which exceeds total expense ${formatINR(total)}`
    );
  }

  const sharedRemainder = total - individualTotal;
  const remainderAmts = sharedRemainder > 0
    ? allocateByWeights(sharedRemainder, entries.map(() => 1), entries.map(e => e.id))
    : entries.map(() => 0);

  const allocations: Allocation[] = entries.map((e, i) => ({
    id: e.id,
    amount: e.individualAmount + remainderAmts[i],
  }));

  mustEqual(total, sumAmounts(allocations), 'The final shares');

  return {
    individualTotal,
    sharedRemainder,
    allocations,
  };
}

/**
 * Divide a family's share among its members (equal, or exact custom amounts).
 * The result sums exactly to `amount`. This is a BREAKDOWN of one family debt,
 * never an additional charge on top of it.
 */
export function splitFamilyShare(amount: Paise, memberIds: string[], custom?: Allocation[]): Allocation[] {
  if (custom) return customSplit(amount, custom);
  return equalSplit(amount, memberIds);
}

export interface MixedPart {
  type: 'family' | 'person';
  id: string;
  amount: Paise;
  /** Optional: how a family's share is divided among its members (info only). */
  members?: { ids: string[]; custom?: Allocation[] };
}
export interface MixedResult {
  allocations: Allocation[];                       // accounts that actually owe (p:/f: keys)
  memberBreakdown: Record<string, Allocation[]>;   // familyKey -> member amounts (sum == family share)
}

/** Mixed mode: families and individuals in one expense, no double-charging. */
export function mixedSplit(total: Paise, parts: MixedPart[]): MixedResult {
  const keys = parts.map(p => (p.type === 'family' ? familyKey(p.id) : personKey(p.id)));
  uniqueIds(keys);
  parts.forEach(p => assertPaise(p.amount, 'share'));
  mustEqual(total, parts.reduce((a, p) => a + p.amount, 0), 'The shares');
  const memberBreakdown: Record<string, Allocation[]> = {};
  parts.forEach((p, i) => {
    if (p.type === 'family' && p.members) memberBreakdown[keys[i]] = splitFamilyShare(p.amount, p.members.ids, p.members.custom);
  });
  return { allocations: parts.map((p, i) => ({ id: keys[i], amount: p.amount })), memberBreakdown };
}
