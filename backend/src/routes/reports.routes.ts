import { Router, Request, Response } from 'express';
import { requireAuth, requireTripAccess } from '../auth/middleware';
import { loadTripFinancialRecords } from './repayments.routes';
import { computeBalances, formatINR } from '../finance';

export const reportsRouter = Router({ mergeParams: true });

// GET /api/trips/:tripId/reports - Detailed trip financial and attendance report
reportsRouter.get('/', requireAuth, requireTripAccess('tripId'), (req: Request, res: Response) => {
  const trip = req.trip!;
  const tripId = trip.id;

  try {
    const { expenses, repayments, assumptions } = loadTripFinancialRecords(req.db, tripId);
    const balances = computeBalances(expenses, repayments, assumptions);

    // Total spending
    const totalSpentPaise = expenses.reduce((a, e) => a + e.total, 0);

    // Spending by category
    const categoryRows = req.db.prepare(`
      SELECT category, sum(total_paise) as total_paise, count(*) as count
      FROM expenses
      WHERE trip_id = ? AND voided_at IS NULL
      GROUP BY category
      ORDER BY total_paise DESC
    `).all(tripId) as Array<{ category: string; total_paise: number; count: number }>;

    // Spending by payer
    const payerRows = req.db.prepare(`
      SELECT paid_by_type, paid_by_id, sum(total_paise) as total_paise, count(*) as count,
             CASE
               WHEN paid_by_type = 'person' THEN (SELECT display_name FROM persons WHERE id = paid_by_id)
               WHEN paid_by_type = 'family' THEN (SELECT name FROM families WHERE id = paid_by_id)
             END as payer_name
      FROM expenses
      WHERE trip_id = ? AND voided_at IS NULL
      GROUP BY paid_by_type, paid_by_id
      ORDER BY total_paise DESC
    `).all(tripId);

    // Individual vs Family shares summary
    const allocationSummary = req.db.prepare(`
      SELECT ea.account_type, sum(ea.amount_paise) as total_paise, count(DISTINCT ea.expense_id) as expense_count
      FROM expense_allocations ea
      JOIN expenses e ON ea.expense_id = e.id
      WHERE e.trip_id = ? AND e.voided_at IS NULL
      GROUP BY ea.account_type
    `).all(tripId);

    // Attendance stats
    const attendanceStats = req.db.prepare(`
      SELECT attendance, count(*) as count
      FROM trip_participants
      WHERE trip_id = ?
      GROUP BY attendance
    `).all(tripId) as Array<{ attendance: string; count: number }>;

    // Budget utilization
    let budgetUtilization = null;
    if (trip.budget_paise && trip.budget_paise > 0) {
      const percentage = Math.round((totalSpentPaise / trip.budget_paise) * 10000) / 100;
      budgetUtilization = {
        budgetPaise: trip.budget_paise,
        budgetFormatted: formatINR(trip.budget_paise),
        totalSpentPaise,
        totalSpentFormatted: formatINR(totalSpentPaise),
        percentage,
        remainingPaise: trip.budget_paise - totalSpentPaise,
        remainingFormatted: formatINR(trip.budget_paise - totalSpentPaise),
        isOverBudget: totalSpentPaise > trip.budget_paise,
      };
    }

    res.json({
      tripId,
      tripName: trip.name,
      destination: trip.destination,
      status: trip.status,
      totalSpentPaise,
      totalSpentFormatted: formatINR(totalSpentPaise),
      budgetUtilization,
      byCategory: categoryRows.map(c => ({
        category: c.category,
        totalPaise: c.total_paise,
        totalFormatted: formatINR(c.total_paise),
        percentageOfTotal: totalSpentPaise > 0 ? Math.round((c.total_paise / totalSpentPaise) * 10000) / 100 : 0,
        count: c.count,
      })),
      byPayer: payerRows,
      allocationSummary,
      attendanceStats,
    });
  } catch (err) {
    res.status(500).json({ error: 'REPORT_ERROR', message: (err as Error).message });
  }
});
