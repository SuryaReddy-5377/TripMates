import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { requireAuth, requireTripAccess } from '../auth/middleware';
import { withTransaction } from '../db/connection';
import { recordAuditLog } from '../auth/audit';
import { notifyExpenseAdded } from '../notifications/service';
import {
  Allocation,
  BillItem,
  Charge,
  computeItemizedBill,
  equalSplit,
  perHeadSplit,
  customSplit,
  percentageSplit,
  mixedSplit,
  splitFamilyShare,
  individualRemainderSplit,
  summarizeExpense,
  validateExpense,
  parseRupees,
  personKey,
  familyKey,
} from '../finance';

export const expensesRouter = Router({ mergeParams: true });

export function keyToAccount(key: string): { type: 'person' | 'family'; id: number } {
  const [prefix, idStr] = key.split(':');
  if (prefix !== 'p' && prefix !== 'f') {
    throw new Error(`Invalid account key: ${key}`);
  }
  const id = Number(idStr);
  if (!id || isNaN(id)) {
    throw new Error(`Invalid account id in key: ${key}`);
  }
  return {
    type: prefix === 'p' ? 'person' : 'family',
    id,
  };
}

export function accountToKey(type: 'person' | 'family', id: number): string {
  return type === 'person' ? personKey(id) : familyKey(id);
}

const expenseInputSchema = z.object({
  title: z.string().min(1),
  expense_date: z.string().min(1),
  category: z.string().min(1),
  paid_by_type: z.enum(['person', 'family']),
  paid_by_id: z.number().int().positive(),
  accounting_mode: z.enum(['individual', 'family', 'mixed']),
  split_method: z.enum(['equal', 'per_head', 'family_wise', 'individual', 'individual_remainder', 'itemized', 'custom', 'percentage']),
  total_paise: z.number().int().positive().optional(),
  total_rupees: z.union([z.string(), z.number()]).optional(),
  notes: z.string().optional().nullable(),
  receipt_total_paise: z.number().int().nonnegative().optional().nullable(),
  receipt_total_rupees: z.union([z.string(), z.number()]).optional().nullable(),

  // For equal split: array of account keys (e.g. ['p:1', 'p:2'])
  participant_keys: z.array(z.string()).optional(),

  // For per-head: rate in paise + entries { id, heads }
  per_head_rate_paise: z.number().int().positive().optional(),
  per_head_entries: z.array(z.object({ id: z.string(), heads: z.number().int().positive() })).optional(),

  // For custom / individual: entries { id, amount_paise }
  custom_entries: z.array(z.object({ id: z.string(), amount_paise: z.number().int().nonnegative() })).optional(),

  // For individual amount + equal shared remainder
  individual_remainder_entries: z.array(z.object({ id: z.string(), individual_amount_paise: z.number().int().nonnegative() })).optional(),
  individual_entries: z.array(z.object({ id: z.string(), individual_amount_paise: z.number().int().nonnegative() })).optional(),

  // For percentage: entries { id, bps }
  percentage_entries: z.array(z.object({ id: z.string(), bps: z.number().int().nonnegative() })).optional(),

  // For itemized bills
  items: z.array(z.object({
    name: z.string().min(1),
    unitPrice: z.number().int().nonnegative(),
    quantity: z.number().int().positive(),
    assignees: z.array(z.string()).min(1),
    method: z.enum(['equal', 'byQuantity', 'custom']).optional(),
    weights: z.record(z.string(), z.number()).optional(),
    customAmounts: z.record(z.string(), z.number()).optional(),
  })).optional(),

  charges: z.array(z.object({
    kind: z.enum(['tax', 'service', 'tip', 'discount', 'adjustment']),
    label: z.string().optional(),
    amount: z.number().int().nonnegative(),
    direction: z.enum(['add', 'subtract']).optional(),
    allocation: z.any().optional(),
  })).optional(),

  // For mixed mode
  mixed_parts: z.array(z.object({
    type: z.enum(['family', 'person']),
    id: z.string(),
    amount: z.number().int().nonnegative(),
    members: z.object({
      ids: z.array(z.string()),
      custom: z.array(z.object({ id: z.string(), amount: z.number().int().nonnegative() })).optional(),
    }).optional(),
  })).optional(),

  // Optional manual family share breakdown
  family_breakdowns: z.record(z.string(), z.array(z.object({ id: z.string(), amount: z.number().int().nonnegative() }))).optional(),
});

function calculateSplitResult(input: z.infer<typeof expenseInputSchema>) {
  let totalPaise = input.total_paise;
  if (!totalPaise && input.total_rupees !== undefined) {
    totalPaise = typeof input.total_rupees === 'number'
      ? Math.round(input.total_rupees * 100)
      : parseRupees(String(input.total_rupees));
  }

  let receiptTotalPaise = input.receipt_total_paise;
  if (receiptTotalPaise === undefined && input.receipt_total_rupees !== undefined && input.receipt_total_rupees !== null && input.receipt_total_rupees !== '') {
    receiptTotalPaise = typeof input.receipt_total_rupees === 'number'
      ? Math.round(input.receipt_total_rupees * 100)
      : parseRupees(String(input.receipt_total_rupees));
  }

  let allocations: Allocation[] = [];
  let warnings: any[] = [];
  let itemizedResult: any = null;
  let familyBreakdowns: Record<string, Allocation[]> = {};

  if (input.split_method === 'itemized') {
    if (!input.items || input.items.length === 0) {
      throw new Error('At least one item is required for itemized bills');
    }
    const itemized = computeItemizedBill({
      items: input.items as BillItem[],
      charges: (input.charges || []) as Charge[],
      receiptTotal: receiptTotalPaise ?? undefined,
    });
    totalPaise = itemized.total;
    allocations = itemized.allocations;
    warnings = itemized.warnings;
    itemizedResult = itemized;
  } else if (input.split_method === 'equal') {
    if (!totalPaise) throw new Error('Total amount is required for equal split');
    if (!input.participant_keys || input.participant_keys.length === 0) {
      throw new Error('At least one participant must be selected');
    }
    allocations = equalSplit(totalPaise, input.participant_keys);
  } else if (input.split_method === 'per_head') {
    if (!input.per_head_rate_paise) throw new Error('Per-head rate is required');
    if (!input.per_head_entries || input.per_head_entries.length === 0) throw new Error('Per-head entries are required');
    const phRes = perHeadSplit(input.per_head_rate_paise, input.per_head_entries);
    totalPaise = phRes.total;
    allocations = phRes.allocations;
  } else if (input.split_method === 'custom' || input.split_method === 'individual') {
    if (!totalPaise) throw new Error('Total amount is required');
    if (!input.custom_entries || input.custom_entries.length === 0) throw new Error('Custom entries are required');
    const entries = input.custom_entries.map(e => ({ id: e.id, amount: e.amount_paise }));
    allocations = customSplit(totalPaise, entries);
  } else if (input.split_method === 'individual_remainder') {
    if (!totalPaise) throw new Error('Total amount is required');
    const rawEntries = input.individual_remainder_entries || input.individual_entries;
    if (!rawEntries || rawEntries.length === 0) {
      if (input.participant_keys && input.participant_keys.length > 0) {
        const res = individualRemainderSplit(totalPaise, input.participant_keys.map(k => ({ id: k, individualAmount: 0 })));
        allocations = res.allocations;
      } else {
        throw new Error('At least one participant must be selected');
      }
    } else {
      const entries = rawEntries.map(e => ({
        id: e.id,
        individualAmount: e.individual_amount_paise,
      }));
      const res = individualRemainderSplit(totalPaise, entries);
      allocations = res.allocations;
    }
  } else if (input.split_method === 'percentage') {
    if (!totalPaise) throw new Error('Total amount is required');
    if (!input.percentage_entries || input.percentage_entries.length === 0) throw new Error('Percentage entries are required');
    allocations = percentageSplit(totalPaise, input.percentage_entries);
  } else if (input.split_method === 'family_wise') {
    if (!totalPaise) throw new Error('Total amount is required');
    if (input.accounting_mode === 'mixed' && input.mixed_parts) {
      const mixed = mixedSplit(totalPaise, input.mixed_parts);
      allocations = mixed.allocations;
      familyBreakdowns = mixed.memberBreakdown;
    } else if (input.custom_entries && input.custom_entries.length > 0) {
      allocations = customSplit(totalPaise, input.custom_entries.map(e => ({ id: e.id, amount: e.amount_paise })));
    } else if (input.participant_keys && input.participant_keys.length > 0) {
      allocations = equalSplit(totalPaise, input.participant_keys);
    } else {
      throw new Error('Family participants are required');
    }
  }

  // If manual family breakdown was passed, use it
  if (input.family_breakdowns) {
    for (const [famKey, members] of Object.entries(input.family_breakdowns)) {
      const famAlloc = allocations.find(a => a.id === famKey);
      if (famAlloc) {
        familyBreakdowns[famKey] = splitFamilyShare(famAlloc.amount, members.map(m => m.id), members);
      }
    }
  }

  const payerKey = accountToKey(input.paid_by_type, input.paid_by_id);
  const expenseData = {
    id: '0',
    paidBy: payerKey,
    total: totalPaise!,
    allocations,
  };

  validateExpense(expenseData);
  const summary = summarizeExpense(expenseData);

  return {
    totalPaise: totalPaise!,
    receiptTotalPaise,
    allocations,
    warnings,
    itemizedResult,
    familyBreakdowns,
    summary,
  };
}

// POST /api/trips/:tripId/expenses/preview - Preview split calculation without saving
expensesRouter.post('/preview', requireAuth, requireTripAccess('tripId'), (req: Request, res: Response) => {
  const parseResult = expenseInputSchema.safeParse(req.body);
  if (!parseResult.success) {
    res.status(400).json({ error: 'VALIDATION_ERROR', details: parseResult.error.format() });
    return;
  }

  try {
    const result = calculateSplitResult(parseResult.data);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: 'CALCULATION_ERROR', message: (err as Error).message });
  }
});

// GET /api/trips/:tripId/expenses - List trip expenses
expensesRouter.get('/', requireAuth, requireTripAccess('tripId'), (req: Request, res: Response) => {
  const tripId = req.trip!.id;
  const userPersonId = req.person?.id || null;

  const expenses = req.db.prepare(`
    SELECT e.id, e.trip_id, e.title, e.expense_date, e.category, e.currency,
           e.total_paise, e.paid_by_type, e.paid_by_id, e.accounting_mode,
           e.split_method, e.notes, e.receipt_total_paise, e.created_by,
           e.created_at, e.voided_at,
           CASE
             WHEN e.paid_by_type = 'person' THEN (SELECT display_name FROM persons WHERE id = e.paid_by_id)
             WHEN e.paid_by_type = 'family' THEN (SELECT name FROM families WHERE id = e.paid_by_id)
           END as payer_name,
           (SELECT count(*) FROM expense_items ei WHERE ei.expense_id = e.id) as item_count,
           (SELECT count(*) FROM expense_allocations ea WHERE ea.expense_id = e.id) as participant_count,
           coalesce(
             (SELECT ea.amount_paise FROM expense_allocations ea WHERE ea.expense_id = e.id AND ea.account_type = 'person' AND ea.account_id = ?),
             (SELECT fsb.amount_paise FROM family_share_breakdown fsb WHERE fsb.expense_id = e.id AND fsb.person_id = ?),
             0
           ) as my_share_paise,
           CASE
             WHEN e.paid_by_type = 'person' AND e.paid_by_id = ? THEN 1
             ELSE 0
           END as is_my_payment
    FROM expenses e
    WHERE e.trip_id = ?
    ORDER BY e.expense_date DESC, e.id DESC
  `).all(userPersonId, userPersonId, userPersonId, tripId);

  res.json(expenses);
});

// GET /api/trips/:tripId/expenses/:expenseId - Detailed expense with items and allocations
expensesRouter.get('/:expenseId', requireAuth, requireTripAccess('tripId'), (req: Request, res: Response) => {
  const tripId = req.trip!.id;
  const expenseId = Number(req.params.expenseId);

  const expense = req.db.prepare(`
    SELECT e.*,
           CASE
             WHEN e.paid_by_type = 'person' THEN (SELECT display_name FROM persons WHERE id = e.paid_by_id)
             WHEN e.paid_by_type = 'family' THEN (SELECT name FROM families WHERE id = e.paid_by_id)
           END as payer_name
    FROM expenses e
    WHERE e.id = ? AND e.trip_id = ?
  `).get(expenseId, tripId);

  if (!expense) {
    res.status(404).json({ error: 'NOT_FOUND', message: 'Expense not found' });
    return;
  }

  const items = req.db.prepare(`
    SELECT id, name, unit_price_paise, quantity, subtotal_paise, notes
    FROM expense_items
    WHERE expense_id = ?
    ORDER BY id ASC
  `).all(expenseId);

  const charges = req.db.prepare(`
    SELECT id, kind, label, signed_amount_paise
    FROM expense_charges
    WHERE expense_id = ?
    ORDER BY id ASC
  `).all(expenseId);

  const allocations = req.db.prepare(`
    SELECT ea.id, ea.account_type, ea.account_id, ea.amount_paise,
           CASE
             WHEN ea.account_type = 'person' THEN (SELECT display_name FROM persons WHERE id = ea.account_id)
             WHEN ea.account_type = 'family' THEN (SELECT name FROM families WHERE id = ea.account_id)
           END as account_name
    FROM expense_allocations ea
    WHERE ea.expense_id = ?
    ORDER BY ea.amount_paise DESC
  `).all(expenseId);

  const familyBreakdowns = req.db.prepare(`
    SELECT fsb.id, fsb.family_id, fsb.person_id, fsb.amount_paise,
           p.display_name as person_name,
           f.name as family_name
    FROM family_share_breakdown fsb
    JOIN persons p ON fsb.person_id = p.id
    JOIN families f ON fsb.family_id = f.id
    WHERE fsb.expense_id = ?
    ORDER BY fsb.family_id, p.display_name
  `).all(expenseId);

  res.json({
    ...(expense as object),
    items,
    charges,
    allocations,
    family_breakdowns: familyBreakdowns,
  });
});

// POST /api/trips/:tripId/expenses - Save expense with safe transaction
expensesRouter.post('/', requireAuth, requireTripAccess('tripId'), (req: Request, res: Response) => {
  const tripId = req.trip!.id;
  const parseResult = expenseInputSchema.safeParse(req.body);
  if (!parseResult.success) {
    res.status(400).json({ error: 'VALIDATION_ERROR', details: parseResult.error.format() });
    return;
  }

  const input = parseResult.data;

  try {
    const calc = calculateSplitResult(input);

    const saved = withTransaction(req.db, () => {
      const expRes = req.db.prepare(`
        INSERT INTO expenses (
          trip_id, title, expense_date, category, currency, total_paise,
          paid_by_type, paid_by_id, accounting_mode, split_method,
          notes, receipt_total_paise, created_by
        ) VALUES (?, ?, ?, ?, 'INR', ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        tripId,
        input.title,
        input.expense_date,
        input.category,
        calc.totalPaise,
        input.paid_by_type,
        input.paid_by_id,
        input.accounting_mode,
        input.split_method,
        input.notes || null,
        calc.receiptTotalPaise ?? null,
        req.user!.id
      );

      const expenseId = Number(expRes.lastInsertRowid);

      // Insert items if itemized
      if (input.split_method === 'itemized' && input.items) {
        for (const item of input.items) {
          const subtotal = item.unitPrice * item.quantity;
          req.db.prepare(`
            INSERT INTO expense_items (expense_id, name, unit_price_paise, quantity, subtotal_paise)
            VALUES (?, ?, ?, ?, ?)
          `).run(expenseId, item.name, item.unitPrice, item.quantity, subtotal);
        }

        if (input.charges) {
          for (const charge of input.charges) {
            const isNegative = charge.kind === 'discount' || (charge.kind === 'adjustment' && charge.direction === 'subtract');
            const signedAmount = isNegative ? -charge.amount : charge.amount;
            req.db.prepare(`
              INSERT INTO expense_charges (expense_id, kind, label, signed_amount_paise)
              VALUES (?, ?, ?, ?)
            `).run(expenseId, charge.kind, charge.label || null, signedAmount);
          }
        }
      }

      // Insert final allocations
      for (const alloc of calc.allocations) {
        const { type, id } = keyToAccount(alloc.id);
        req.db.prepare(`
          INSERT INTO expense_allocations (expense_id, account_type, account_id, amount_paise)
          VALUES (?, ?, ?, ?)
        `).run(expenseId, type, id, alloc.amount);
      }

      // Insert family share breakdowns if any
      for (const [famKey, members] of Object.entries(calc.familyBreakdowns)) {
        const famAcct = keyToAccount(famKey);
        for (const m of members) {
          const memAcct = keyToAccount(m.id);
          req.db.prepare(`
            INSERT INTO family_share_breakdown (expense_id, family_id, person_id, amount_paise)
            VALUES (?, ?, ?, ?)
          `).run(expenseId, famAcct.id, memAcct.id, m.amount);
        }
      }

      recordAuditLog(req.db, req.user!.id, 'CREATE_EXPENSE', 'expenses', expenseId, null, {
        title: input.title,
        totalPaise: calc.totalPaise,
        splitMethod: input.split_method,
      });

      notifyExpenseAdded(req.db, {
        tripId,
        expenseId,
        title: input.title,
        totalPaise: calc.totalPaise,
        paidByType: input.paid_by_type,
        paidById: input.paid_by_id,
        allocations: calc.allocations,
        familyBreakdowns: calc.familyBreakdowns,
        createdByUserId: req.user!.id,
      });

      return {
        id: expenseId,
        title: input.title,
        totalPaise: calc.totalPaise,
        summary: calc.summary,
        warnings: calc.warnings,
      };
    });

    res.status(201).json(saved);
  } catch (err) {
    res.status(400).json({ error: 'FAILED_TO_SAVE_EXPENSE', message: (err as Error).message });
  }
});

// DELETE /api/trips/:tripId/expenses/:expenseId - Void expense
expensesRouter.delete('/:expenseId', requireAuth, requireTripAccess('tripId'), (req: Request, res: Response) => {
  const tripId = req.trip!.id;
  const expenseId = Number(req.params.expenseId);

  const expense = req.db.prepare(`
    SELECT * FROM expenses WHERE id = ? AND trip_id = ?
  `).get(expenseId, tripId) as any;

  if (!expense) {
    res.status(404).json({ error: 'NOT_FOUND', message: 'Expense not found' });
    return;
  }

  if (expense.voided_at) {
    res.status(400).json({ error: 'ALREADY_VOIDED', message: 'This expense is already voided' });
    return;
  }

  // Only creator, trip creator, or super admin can void
  if (req.user!.role !== 'super_admin' && req.trip!.created_by !== req.user!.id && expense.created_by !== req.user!.id) {
    res.status(403).json({ error: 'FORBIDDEN', message: 'You do not have permission to void this expense' });
    return;
  }

  const voidedAt = new Date().toISOString();
  req.db.prepare(`
    UPDATE expenses SET voided_at = ? WHERE id = ?
  `).run(voidedAt, expenseId);

  recordAuditLog(req.db, req.user!.id, 'VOID_EXPENSE', 'expenses', expenseId, { voided_at: null }, { voided_at: voidedAt });

  res.json({ message: 'Expense voided successfully', voided_at: voidedAt });
});
