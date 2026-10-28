import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { requireAuth, requireTripAccess } from '../auth/middleware';
import { withTransaction } from '../db/connection';
import { recordAuditLog } from '../auth/audit';
import {
  computeBalances,
  suggestSettlements,
  settlementStatus,
  assertReconciled,
  formatINR,
  parseRupees,
} from '../finance';
import { loadTripFinancialRecords } from './repayments.routes';
import { keyToAccount, accountToKey } from './expenses.routes';

export const settlementsRouter = Router({ mergeParams: true });

const assumptionSchema = z.object({
  debtor_type: z.enum(['person', 'family']),
  debtor_id: z.number().int().positive(),
  assumed_by_type: z.enum(['person', 'family']),
  assumed_by_id: z.number().int().positive(),
  amount_paise: z.number().int().positive().optional(),
  amount_rupees: z.union([z.string(), z.number()]).optional(),
});

// GET /api/trips/:tripId/ledger - Full ledger with balances and settlement suggestions
settlementsRouter.get('/ledger', requireAuth, requireTripAccess('tripId'), (req: Request, res: Response) => {
  const tripId = req.trip!.id;

  try {
    const { expenses, repayments, assumptions } = loadTripFinancialRecords(req.db, tripId);
    const balances = computeBalances(expenses, repayments, assumptions);

    // Verify zero-sum reconciliation
    assertReconciled(balances);

    const suggestions = suggestSettlements(balances);
    const status = settlementStatus(balances);

    // Lookup account names
    const enrichedBalances = Object.entries(balances).map(([key, b]) => {
      const { type, id } = keyToAccount(key);
      let name = key;
      if (type === 'person') {
        const row = req.db.prepare('SELECT display_name FROM persons WHERE id = ?').get(id) as { display_name: string } | undefined;
        if (row) name = row.display_name;
      } else {
        const row = req.db.prepare('SELECT name FROM families WHERE id = ?').get(id) as { name: string } | undefined;
        if (row) name = row.name;
      }

      return {
        key,
        type,
        id,
        name,
        paid: b.paid,
        share: b.share,
        sent: b.sent,
        received: b.received,
        assumedCredit: b.assumedCredit,
        assumedDebit: b.assumedDebit,
        net: b.net,
        formattedNet: formatINR(b.net),
        status: b.net > 0 ? 'receives' : b.net < 0 ? 'owes' : 'settled',
      };
    });

    const enrichedSuggestions = suggestions.map(s => {
      const fromAcct = keyToAccount(s.from);
      const toAcct = keyToAccount(s.to);
      let fromName = s.from;
      let toName = s.to;

      if (fromAcct.type === 'person') {
        const row = req.db.prepare('SELECT display_name FROM persons WHERE id = ?').get(fromAcct.id) as any;
        if (row) fromName = row.display_name;
      } else {
        const row = req.db.prepare('SELECT name FROM families WHERE id = ?').get(fromAcct.id) as any;
        if (row) fromName = row.name;
      }

      if (toAcct.type === 'person') {
        const row = req.db.prepare('SELECT display_name FROM persons WHERE id = ?').get(toAcct.id) as any;
        if (row) toName = row.display_name;
      } else {
        const row = req.db.prepare('SELECT name FROM families WHERE id = ?').get(toAcct.id) as any;
        if (row) toName = row.name;
      }

      return {
        from: s.from,
        from_type: fromAcct.type,
        from_id: fromAcct.id,
        from_name: fromName,
        to: s.to,
        to_type: toAcct.type,
        to_id: toAcct.id,
        to_name: toName,
        amount: s.amount,
        formattedAmount: formatINR(s.amount),
      };
    });

    const totalGroupSpend = expenses.reduce((a, e) => a + e.total, 0);
    const totalRepayments = repayments.reduce((a, r) => a + r.amount, 0);

    res.json({
      tripId,
      status,
      totalGroupSpend,
      totalRepayments,
      balances: enrichedBalances,
      suggestedSettlements: enrichedSuggestions,
      rawBalances: balances,
    });
  } catch (err) {
    res.status(500).json({ error: 'LEDGER_ERROR', message: (err as Error).message });
  }
});

// POST /api/trips/:tripId/assumptions - Record a covered share / debt assumption
settlementsRouter.post('/assumptions', requireAuth, requireTripAccess('tripId'), (req: Request, res: Response) => {
  const tripId = req.trip!.id;
  const parseResult = assumptionSchema.safeParse(req.body);
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
    res.status(400).json({ error: 'BAD_AMOUNT', message: 'Amount must be greater than zero' });
    return;
  }

  try {
    const saved = withTransaction(req.db, () => {
      const res = req.db.prepare(`
        INSERT INTO debt_assumptions (trip_id, debtor_type, debtor_id, assumed_by_type, assumed_by_id, amount_paise, recorded_by)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(
        tripId,
        input.debtor_type,
        input.debtor_id,
        input.assumed_by_type,
        input.assumed_by_id,
        amountPaise,
        req.user!.id
      );

      const id = Number(res.lastInsertRowid);
      recordAuditLog(req.db, req.user!.id, 'CREATE_DEBT_ASSUMPTION', 'debt_assumptions', id, null, input);

      return { id, ...input, amount_paise: amountPaise };
    });

    res.status(201).json(saved);
  } catch (err) {
    res.status(400).json({ error: 'FAILED_TO_RECORD_ASSUMPTION', message: (err as Error).message });
  }
});
