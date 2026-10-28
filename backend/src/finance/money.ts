/** Money is ALWAYS integer paise (1 INR = 100 paise). Never floats. */
export type Paise = number;

export class FinanceError extends Error {
  constructor(public readonly code: string, message: string) {
    super(message);
    this.name = 'FinanceError';
  }
}

export interface Allocation { id: string; amount: Paise }

export function assertPaise(v: number, label = 'amount', opts: { allowZero?: boolean } = {}): void {
  const allowZero = opts.allowZero ?? true;
  if (!Number.isSafeInteger(v)) throw new FinanceError('NOT_INTEGER', `${label} must be a whole number of paise`);
  if (v < 0) throw new FinanceError('NEGATIVE', `${label} must not be negative`);
  if (!allowZero && v === 0) throw new FinanceError('ZERO', `${label} must be greater than zero`);
}

export function assertQuantity(q: number, label = 'quantity'): void {
  if (!Number.isSafeInteger(q) || q <= 0) throw new FinanceError('BAD_QUANTITY', `${label} must be a positive whole number`);
}

/** Parse "50", "50.5", "1250.25" into paise without floating point. */
export function parseRupees(input: string): Paise {
  const m = /^(\d+)(?:\.(\d{1,2}))?$/.exec(input.trim());
  if (!m) throw new FinanceError('BAD_AMOUNT', `"${input}" is not a valid rupee amount`);
  return Number(m[1]) * 100 + Number((m[2] ?? '').padEnd(2, '0') || '0');
}

/** Indian digit grouping: ₹1,25,000.50 */
export function formatINR(p: Paise): string {
  const neg = p < 0;
  const abs = Math.abs(p);
  const rupees = String(Math.floor(abs / 100));
  const paise = abs % 100;
  const last3 = rupees.slice(-3);
  const rest = rupees.slice(0, -3);
  const grouped = rest ? rest.replace(/\B(?=(\d{2})+(?!\d))/g, ',') + ',' + last3 : last3;
  return `${neg ? '-' : ''}₹${grouped}${paise ? '.' + String(paise).padStart(2, '0') : ''}`;
}

export const sum = (xs: number[]): number => xs.reduce((a, b) => a + b, 0);
export const sumAmounts = (a: Allocation[]): Paise => sum(a.map(x => x.amount));

/**
 * Largest-remainder allocation. Result always sums exactly to `total`.
 * Deterministic: leftover paise go to the largest fractional remainders;
 * ties are broken by tieKeys (ascending) then by position. BigInt avoids overflow.
 */
export function allocateByWeights(total: Paise, weights: number[], tieKeys?: string[]): Paise[] {
  assertPaise(total, 'total');
  if (weights.length === 0) throw new FinanceError('NO_PARTICIPANTS', 'Select at least one participant');
  weights.forEach(w => {
    if (!Number.isSafeInteger(w) || w < 0) throw new FinanceError('BAD_WEIGHT', 'Weights must be non-negative whole numbers');
  });
  const W = weights.reduce((a, w) => a + BigInt(w), 0n);
  if (W === 0n) throw new FinanceError('ZERO_WEIGHT', 'Weights must not all be zero');
  const T = BigInt(total);
  const floors = weights.map(w => (T * BigInt(w)) / W);
  const rems = weights.map(w => (T * BigInt(w)) % W);
  let leftover = Number(T - floors.reduce((a, b) => a + b, 0n));
  const order = weights.map((_, i) => i).sort((a, b) => {
    if (rems[a] !== rems[b]) return rems[a] > rems[b] ? -1 : 1;
    const ka = tieKeys?.[a] ?? '', kb = tieKeys?.[b] ?? '';
    if (ka !== kb) return ka < kb ? -1 : 1;
    return a - b;
  });
  const out = floors.map(Number);
  for (let k = 0; k < leftover; k++) out[order[k]] += 1;
  return out;
}

export function mergeAllocations(...lists: Allocation[][]): Allocation[] {
  const m = new Map<string, number>();
  for (const l of lists) for (const a of l) m.set(a.id, (m.get(a.id) ?? 0) + a.amount);
  return [...m.entries()].map(([id, amount]) => ({ id, amount }));
}
