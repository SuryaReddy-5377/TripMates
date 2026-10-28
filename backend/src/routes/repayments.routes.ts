import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { requireAuth, requireTripAccess } from '../auth/middleware';
import { withTransaction } from '../db/connection';
import { recordAuditLog } from '../auth/audit';
import { notifyRepaymentCreated } from '../notifications/service';
import {
  computeBalances,
  validateRepayment,
  Expense,
  Repayment,
  DebtAssumption,
  parseRupees,
} from '../finance';
import { accountToKey, keyToAccount } from './expenses.routes';

export const repaymentsRouter = Router({ mergeParams: true });

const createRepaymentSchema = z.object({
  from_type: z.enum(['person', 'family']),
  from_id: z.number().int().positive(),
  to_type: z.enum(['person', 'family']),
  to_id: z.number().int().positive(),
  amount_paise: z.number().int().positive().optional(),
  amount_rupees: z.union([z.string(), z.number()]).optional(),
  paid_on: z.string().min(1),
  reference: z.string().optional().nullable(),
  note: z.string().optional().nullable(),
  idempotency_key: z.string().optional().nullable(),
  allow_advance: z.boolean().optional().default(false),
});

export function loadTripFinancialRecords(db: any, tripId: number) {
  // Load non-voided expenses
  const expRows = db.prepare(`
    SELECT id, total_paise, paid_by_type, paid_by_id
    FROM expenses
    WHERE trip_id = ? AND voided_at IS NULL
  `).all(tripId) as Array<{ id: number; total_paise: number; paid_by_type: 'person' | 'family'; paid_by_id: number }>;

  const expenses: Expense[] = [];
  for (const exp of expRows) {
    const allocRows = db.prepare(`
      SELECT account_type, account_id, amount_paise
      FROM expense_allocations
      WHERE expense_id = ?
    `).all(exp.id) as Array<{ account_type: 'person' | 'family'; account_id: number; amount_paise: number }>;

    expenses.push({
      id: String(exp.id),
      paidBy: accountToKey(exp.paid_by_type, exp.paid_by_id),
      total: exp.total_paise,
      allocations: allocRows.map(a => ({
        id: accountToKey(a.account_type, a.account_id),
        amount: a.amount_paise,
      })),
    });
  }

  // Load repayments
  const repRows = db.prepare(`
    SELECT id, from_type, from_id, to_type, to_id, amount_paise, paid_on, reference, note, idempotency_key
    FROM repayments
    WHERE trip_id = ?
    ORDER BY paid_on ASC, id ASC
  `).all(tripId) as Array<{
    id: number;
    from_type: 'person' | 'family';
    from_id: number;
    to_type: 'person' | 'family';
    to_id: number;
    amount_paise: number;
    paid_on: string;
    reference: string | null;
    note: string | null;
    idempotency_key: string | null;
  }>;

  const repayments: Repayment[] = repRows.map(r => ({
    id: String(r.id),
    from: accountToKey(r.from_type, r.from_id),
    to: accountToKey(r.to_type, r.to_id),
    amount: r.amount_paise,
    date: r.paid_on,
    reference: r.reference || undefined,
    idempotencyKey: r.idempotency_key || undefined,
  }));

  // Load debt assumptions
  const assumpRows = db.prepare(`
    SELECT id, debtor_type, debtor_id, assumed_by_type, assumed_by_id, amount_paise
    FROM debt_assumptions
    WHERE trip_id = ?
  `).all(tripId) as Array<{
    id: number;
    debtor_type: 'person' | 'family';
    debtor_id: number;
    assumed_by_type: 'person' | 'family';
    assumed_by_id: number;
    amount_paise: number;
  }>;

  const assumptions: DebtAssumption[] = assumpRows.map(a => ({
    id: String(a.id),
    debtor: accountToKey(a.debtor_type, a.debtor_id),
    assumedBy: accountToKey(a.assumed_by_type, a.assumed_by_id),
    amount: a.amount_paise,
  }));

  return { expenses, repayments, assumptions, repRows };
}

// GET /api/trips/:tripId/repayments - List repayments
repaymentsRouter.get('/', requireAuth, requireTripAccess('tripId'), (req: Request, res: Response) => {
  const tripId = req.trip!.id;

  const repayments = req.db.prepare(`
    SELECT r.id, r.trip_id, r.from_type, r.from_id, r.to_type, r.to_id,
           r.amount_paise, r.paid_on, r.reference, r.note, r.idempotency_key,
           r.recorded_by, r.created_at,
           CASE
             WHEN r.from_type = 'person' THEN (SELECT display_name FROM persons WHERE id = r.from_id)
             WHEN r.from_type = 'family' THEN (SELECT name FROM families WHERE id = r.from_id)
           END as from_name,
           CASE
             WHEN r.to_type = 'person' THEN (SELECT display_name FROM persons WHERE id = r.to_id)
             WHEN r.to_type = 'family' THEN (SELECT name FROM families WHERE id = r.to_id)
           END as to_name,
           u.email as recorded_by_email
    FROM repayments r
    JOIN users u ON r.recorded_by = u.id
    WHERE r.trip_id = ?
    ORDER BY r.paid_on DESC, r.id DESC
  `).all(tripId);

  res.json(repayments);
});

// POST /api/trips/:tripId/repayments - Record repayment with validation
repaymentsRouter.post('/', requireAuth, requireTripAccess('tripId'), (req: Request, res: Response) => {
  const tripId = req.trip!.id;
  const parseResult = createRepaymentSchema.safeParse(req.body);
  if (!parseResult.success) {
    res.status(400).json({ error: 'VALIDATION_ERROR', details: parseResult.error.format() });
    return;
  }

  const input = parseResult.data;

  let amountPaise = input.amount_paise;
  if (!amountPaise && input.amount_rupees !== undefined) {
    amountPaise = typeof input.amount_rupees === 'number'
      ? Math.round(input.amount_rupees * 100)
      : parseRupees(String(input.amount_rupees));
  }

  if (!amountPaise || amountPaise <= 0) {
    res.status(400).json({ error: 'BAD_AMOUNT', message: 'Repayment amount must be greater than zero' });
    return;
  }

  const fromKey = accountToKey(input.from_type, input.from_id);
  const toKey = accountToKey(input.to_type, input.to_id);

  if (fromKey === toKey) {
    res.status(400).json({ error: 'SAME_ACCOUNT', message: 'Sender and recipient must be different' });
    return;
  }

  try {
    const { expenses, repayments: existingRepayments, assumptions } = loadTripFinancialRecords(req.db, tripId);
    const currentBalances = computeBalances(expenses, existingRepayments, assumptions);

    const newRepayment: Repayment = {
      id: 'pending',
      from: fromKey,
      to: toKey,
      amount: amountPaise,
      date: input.paid_on,
      reference: input.reference || undefined,
      idempotencyKey: input.idempotency_key || undefined,
    };

    // Validate using existing tested financial engine
    validateRepayment(currentBalances, existingRepayments, newRepayment, { allowAdvance: input.allow_advance });

    const saved = withTransaction(req.db, () => {
      const repRes = req.db.prepare(`
        INSERT INTO repayments (
          trip_id, from_type, from_id, to_type, to_id,
          amount_paise, paid_on, reference, note, idempotency_key, recorded_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        tripId,
        input.from_type,
        input.from_id,
        input.to_type,
        input.to_id,
        amountPaise,
        input.paid_on,
        input.reference || null,
        input.note || null,
        input.idempotency_key || null,
        req.user!.id
      );

      const repaymentId = Number(repRes.lastInsertRowid);

      recordAuditLog(req.db, req.user!.id, 'RECORD_REPAYMENT', 'repayments', repaymentId, null, {
        from: fromKey,
        to: toKey,
        amountPaise,
        paidOn: input.paid_on,
      });

      notifyRepaymentCreated(req.db, {
        tripId,
        repaymentId,
        fromType: input.from_type,
        fromId: input.from_id,
        toType: input.to_type,
        toId: input.to_id,
        amountPaise,
        paidOn: input.paid_on,
        recordedByUserId: req.user!.id,
      });

      return {
        id: repaymentId,
        from_type: input.from_type,
        from_id: input.from_id,
        to_type: input.to_type,
        to_id: input.to_id,
        amount_paise: amountPaise,
        paid_on: input.paid_on,
      };
    });

    res.status(201).json(saved);
  } catch (err) {
    res.status(400).json({ error: 'REPAYMENT_VALIDATION_ERROR', message: (err as Error).message });
  }
});
