import { Allocation, FinanceError, Paise, allocateByWeights, assertPaise, assertQuantity, mergeAllocations, sum, sumAmounts, formatINR } from './money';

export interface BillItem {
  name: string;
  unitPrice: Paise;
  quantity: number;
  /** Accounts (people or families) who ordered / share this item. */
  assignees: string[];
  /** equal (default) | byQuantity (weights = plates each) | custom (exact amounts). */
  method?: 'equal' | 'byQuantity' | 'custom';
  weights?: Record<string, number>;
  customAmounts?: Record<string, Paise>;
}

export type ChargeAllocation =
  | { method: 'proportional' }                       // only people who have item shares, pro-rata to those shares
  | { method: 'equal'; ids: string[] }
  | { method: 'custom'; amounts: Record<string, Paise> };

export interface Charge {
  kind: 'tax' | 'service' | 'tip' | 'discount' | 'adjustment';
  label?: string;
  amount: Paise;                      // always positive; discount is subtracted
  direction?: 'add' | 'subtract';     // only for 'adjustment' (default add)
  allocation?: ChargeAllocation;      // default proportional
}

export interface BillWarning { code: 'RECEIPT_MISMATCH'; expected: Paise; computed: Paise; difference: Paise; message: string }

export interface ItemizedResult {
  itemsSubtotal: Paise;
  chargesTotal: Paise;                // signed
  total: Paise;
  itemSubtotals: { name: string; subtotal: Paise; allocations: Allocation[] }[];
  chargeAllocations: { kind: Charge['kind']; label?: string; signedAmount: Paise; allocations: Allocation[] }[];
  allocations: Allocation[];          // final amount owed per account; sums to `total`
  warnings: BillWarning[];
}

function allocateItem(item: BillItem, subtotal: Paise): Allocation[] {
  const ids = item.assignees;
  if (ids.length === 0) throw new FinanceError('ITEM_NO_ASSIGNEES', `Select who shared "${item.name}"`);
  if (new Set(ids).size !== ids.length) throw new FinanceError('DUPLICATE_PARTICIPANT', `A person was selected twice for "${item.name}"`);
  const method = item.method ?? 'equal';
  if (method === 'equal') {
    const a = allocateByWeights(subtotal, ids.map(() => 1), ids);
    return ids.map((id, i) => ({ id, amount: a[i] }));
  }
  if (method === 'byQuantity') {
    const w = ids.map(id => item.weights?.[id] ?? 0);
    if (w.some(x => !Number.isSafeInteger(x) || x <= 0)) throw new FinanceError('BAD_WEIGHT', `Enter a quantity for everyone sharing "${item.name}"`);
    const a = allocateByWeights(subtotal, w, ids);
    return ids.map((id, i) => ({ id, amount: a[i] }));
  }
  const amounts = item.customAmounts ?? {};
  const keys = Object.keys(amounts);
  if (keys.length !== ids.length || !ids.every(id => id in amounts))
    throw new FinanceError('CUSTOM_MISMATCH', `Custom amounts for "${item.name}" must cover exactly the selected people`);
  const alloc = ids.map(id => ({ id, amount: amounts[id] }));
  alloc.forEach(a => assertPaise(a.amount, 'share'));
  if (sumAmounts(alloc) !== subtotal)
    throw new FinanceError('TOTAL_MISMATCH', `Custom amounts for "${item.name}" add up to ${formatINR(sumAmounts(alloc))} but the item costs ${formatINR(subtotal)}`);
  return alloc;
}

function allocateCharge(c: Charge, itemShares: Allocation[]): Allocation[] {
  assertPaise(c.amount, `${c.kind} amount`);
  const a = c.allocation ?? { method: 'proportional' as const };
  if (a.method === 'proportional') {
    const nz = itemShares.filter(s => s.amount > 0);
    if (nz.length === 0) throw new FinanceError('NO_BASE', 'There are no item shares to apply this charge to');
    const amts = allocateByWeights(c.amount, nz.map(s => s.amount), nz.map(s => s.id));
    return nz.map((s, i) => ({ id: s.id, amount: amts[i] }));
  }
  if (a.method === 'equal') {
    if (a.ids.length === 0) throw new FinanceError('NO_PARTICIPANTS', 'Select who shares this charge');
    const amts = allocateByWeights(c.amount, a.ids.map(() => 1), a.ids);
    return a.ids.map((id, i) => ({ id, amount: amts[i] }));
  }
  const alloc = Object.entries(a.amounts).map(([id, amount]) => ({ id, amount }));
  alloc.forEach(x => assertPaise(x.amount, 'share'));
  if (sumAmounts(alloc) !== c.amount) throw new FinanceError('TOTAL_MISMATCH', `Custom ${c.kind} shares must add up to ${formatINR(c.amount)}`);
  return alloc;
}

/**
 * Compute an itemized bill. Nobody is charged for an item they did not select.
 * If `receiptTotal` differs from the computed total a WARNING is returned;
 * prices and allocations are never silently changed to force a match.
 */
export function computeItemizedBill(input: { items: BillItem[]; charges?: Charge[]; receiptTotal?: Paise }): ItemizedResult {
  if (input.items.length === 0) throw new FinanceError('NO_ITEMS', 'Add at least one item');
  const itemSubtotals = input.items.map(item => {
    assertPaise(item.unitPrice, `${item.name} price`);
    assertQuantity(item.quantity, `${item.name} quantity`);
    const subtotal = item.unitPrice * item.quantity;
    if (!Number.isSafeInteger(subtotal)) throw new FinanceError('OVERFLOW', 'Amount too large');
    return { name: item.name, subtotal, allocations: allocateItem(item, subtotal) };
  });
  const itemShares = mergeAllocations(...itemSubtotals.map(i => i.allocations));
  const itemsSubtotal = sum(itemSubtotals.map(i => i.subtotal));

  const chargeAllocations = (input.charges ?? []).map(c => {
    const negative = c.kind === 'discount' || (c.kind === 'adjustment' && c.direction === 'subtract');
    const allocations = allocateCharge(c, itemShares);
    return { kind: c.kind, label: c.label, signedAmount: negative ? -c.amount : c.amount,
      allocations: allocations.map(a => ({ id: a.id, amount: negative ? -a.amount : a.amount })) };
  });
  const chargesTotal = sum(chargeAllocations.map(c => c.signedAmount));
  const total = itemsSubtotal + chargesTotal;
  const allocations = mergeAllocations(itemShares, ...chargeAllocations.map(c => c.allocations));
  if (allocations.some(a => a.amount < 0)) throw new FinanceError('NEGATIVE_SHARE', 'A discount or adjustment makes someone\'s share negative');
  if (sumAmounts(allocations) !== total) throw new FinanceError('INTERNAL', 'Allocations do not reconcile to the total');

  const warnings: BillWarning[] = [];
  if (input.receiptTotal !== undefined && input.receiptTotal !== total) {
    const difference = total - input.receiptTotal;
    warnings.push({ code: 'RECEIPT_MISMATCH', expected: input.receiptTotal, computed: total, difference,
      message: `Items and charges add up to ${formatINR(total)} but the receipt says ${formatINR(input.receiptTotal)}. Add a tax, discount or adjustment to explain the ${formatINR(Math.abs(difference))} difference.` });
  }
  return { itemsSubtotal, chargesTotal, total, itemSubtotals, chargeAllocations, allocations, warnings };
}
