import { Router, Request, Response } from 'express';
import crypto from 'node:crypto';
import { z } from 'zod';
import { verifyPassword } from '../auth/password';
import { createSession, revokeAllUserSessions } from '../auth/session';
import { requireAuth, requireRole } from '../auth/middleware';
import { withTransaction } from '../db/connection';
import { recordAuditLog } from '../auth/audit';
import { checkRateLimit, recordFailedAttempt, clearRateLimit } from '../auth/rate-limiter';
import { computeBalances } from '../finance';
import { loadTripFinancialRecords } from './repayments.routes';

export const adminRouter = Router();

const adminLoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

// ============================================================================
// 1. DEDICATED SUPER ADMIN LOGIN (FEATURE 5 & FEATURE 7)
// ============================================================================
adminRouter.post('/login', (req: Request, res: Response) => {
  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  const emailAttempt = req.body?.email?.trim()?.toLowerCase() || '';
  const rateLimitKey = `admin_login:${ip}:${emailAttempt}`;

  // Check rate limiting / brute force protection
  const rateCheck = checkRateLimit(rateLimitKey);
  if (!rateCheck.allowed) {
    res.setHeader('Retry-After', String(rateCheck.retryAfterSeconds || 900));
    res.status(429).json({
      error: 'RATE_LIMITED',
      message: `Too many failed login attempts. Please try again in ${rateCheck.retryAfterSeconds || 900} seconds.`,
      retryAfterSeconds: rateCheck.retryAfterSeconds,
    });
    return;
  }

  const parseResult = adminLoginSchema.safeParse(req.body);
  if (!parseResult.success) {
    res.status(400).json({ error: 'VALIDATION_ERROR', details: parseResult.error.format() });
    return;
  }

  const { email, password } = parseResult.data;
  const cleanEmail = email.trim().toLowerCase();

  const userRow = req.db.prepare(`
    SELECT id, email, password_hash, role, is_active, created_at
    FROM users
    WHERE email = ? COLLATE NOCASE
  `).get(cleanEmail) as { id: number; email: string; password_hash: string; role: string; is_active: number; created_at: string } | undefined;

  // Verify user exists and is active
  if (!userRow || userRow.is_active !== 1) {
    recordFailedAttempt(rateLimitKey);
    res.status(401).json({ error: 'INVALID_CREDENTIALS', message: 'Invalid administrative credentials' });
    return;
  }

  // Security: strictly require role === 'super_admin' on this dedicated login portal
  if (userRow.role !== 'super_admin') {
    recordFailedAttempt(rateLimitKey);
    recordAuditLog(req.db, userRow.id, 'UNAUTHORIZED_ADMIN_LOGIN_ATTEMPT', 'users', userRow.id, null, {
      attempted_email: cleanEmail,
      actual_role: userRow.role,
      ip,
    });
    res.status(403).json({
      error: 'FORBIDDEN',
      message: 'Access denied. This dashboard is strictly restricted to designated Super Administrators.',
    });
    return;
  }

  // Verify password hash
  if (!verifyPassword(password, userRow.password_hash)) {
    const attempt = recordFailedAttempt(rateLimitKey);
    res.status(401).json({
      error: 'INVALID_CREDENTIALS',
      message: 'Invalid administrative credentials',
      remainingAttempts: attempt.remaining,
    });
    return;
  }

  // Clear failed rate limit attempts on success
  clearRateLimit(rateLimitKey);

  const session = createSession(req.db, userRow.id);

  res.cookie('session_token', session.token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 30 * 24 * 60 * 60 * 1000,
  });

  const personRow = req.db.prepare(`
    SELECT id, display_name, user_id, is_active
    FROM persons
    WHERE user_id = ? AND is_active = 1
  `).get(userRow.id);

  recordAuditLog(req.db, userRow.id, 'SUPER_ADMIN_LOGIN', 'users', userRow.id, null, { ip });

  res.json({
    message: 'Super Admin authentication successful',
    token: session.token,
    user: {
      id: userRow.id,
      email: userRow.email,
      role: userRow.role,
      is_active: userRow.is_active,
      created_at: userRow.created_at,
    },
    person: personRow || null,
  });
});

// ============================================================================
// ALL ROUTES BELOW REQUIRE SUPER_ADMIN ROLE (SERVER-SIDE AUTHORIZATION)
// ============================================================================
adminRouter.use(requireAuth, requireRole('super_admin'));

// ----------------------------------------------------------------------------
// A. OVERVIEW STATS (FEATURE 6.A) - CALCULATED FROM ACTUAL DB
// ----------------------------------------------------------------------------
adminRouter.get('/overview', (req: Request, res: Response) => {
  const db = req.db;

  const totalFamilies = (db.prepare('SELECT count(*) as count FROM families').get() as { count: number }).count;
  const totalUsers = (db.prepare('SELECT count(*) as count FROM users').get() as { count: number }).count;
  const activeUsers = (db.prepare('SELECT count(*) as count FROM users WHERE is_active = 1').get() as { count: number }).count;
  const totalMemberships = (db.prepare('SELECT count(*) as count FROM family_memberships WHERE left_at IS NULL').get() as { count: number }).count;

  const totalTrips = (db.prepare('SELECT count(*) as count FROM trips').get() as { count: number }).count;
  const upcomingTrips = (db.prepare("SELECT count(*) as count FROM trips WHERE status = 'upcoming'").get() as { count: number }).count;
  const ongoingTrips = (db.prepare("SELECT count(*) as count FROM trips WHERE status = 'ongoing'").get() as { count: number }).count;
  const completedTrips = (db.prepare("SELECT count(*) as count FROM trips WHERE status = 'completed'").get() as { count: number }).count;
  const planningTrips = (db.prepare("SELECT count(*) as count FROM trips WHERE status = 'planning'").get() as { count: number }).count;

  const expenseStats = db.prepare(`
    SELECT count(*) as count, coalesce(sum(total_paise), 0) as total_paise
    FROM expenses
    WHERE voided_at IS NULL
  `).get() as { count: number; total_paise: number };

  const repaymentStats = db.prepare(`
    SELECT count(*) as count, coalesce(sum(amount_paise), 0) as total_paise
    FROM repayments
  `).get() as { count: number; total_paise: number };

  // Calculate outstanding balances across active trips
  const activeTripRows = db.prepare(`SELECT id FROM trips WHERE status != 'completed'`).all() as Array<{ id: number }>;
  let totalOutstandingPaise = 0;
  for (const t of activeTripRows) {
    try {
      const { expenses, repayments, assumptions } = loadTripFinancialRecords(db, t.id);
      const balances = computeBalances(expenses, repayments, assumptions);
      for (const b of Object.values(balances)) {
        if (b.net > 0) {
          totalOutstandingPaise += b.net;
        }
      }
    } catch {
      // ignore
    }
  }

  // Recent activity from audit log
  const recentActivity = db.prepare(`
    SELECT al.id, al.action, al.entity, al.entity_id, al.created_at,
           u.email as actor_email,
           p.display_name as actor_name
    FROM audit_log al
    LEFT JOIN users u ON al.actor_user_id = u.id
    LEFT JOIN persons p ON p.user_id = u.id
    ORDER BY al.id DESC
    LIMIT 10
  `).all();

  res.json({
    metrics: {
      total_families: totalFamilies,
      total_users: totalUsers,
      active_users: activeUsers,
      total_memberships: totalMemberships,
      total_trips: totalTrips,
      upcoming_trips: upcomingTrips,
      ongoing_trips: ongoingTrips,
      completed_trips: completedTrips,
      planning_trips: planningTrips,
      total_expenses_count: expenseStats.count,
      total_expenses_paise: expenseStats.total_paise,
      total_repayments_count: repaymentStats.count,
      total_repayments_paise: repaymentStats.total_paise,
      total_outstanding_paise: totalOutstandingPaise,
    },
    recent_activity: recentActivity,
  });
});

// ----------------------------------------------------------------------------
// B. FAMILY MANAGEMENT (FEATURE 6.B)
// ----------------------------------------------------------------------------
adminRouter.get('/families', (req: Request, res: Response) => {
  const search = req.query.search ? `%${String(req.query.search).trim()}%` : null;

  let query = `
    SELECT f.id, f.name, f.admin_user_id, f.is_active, f.created_at,
           u.email as admin_email,
           p.display_name as admin_name,
           (SELECT count(*) FROM family_memberships fm WHERE fm.family_id = f.id AND fm.left_at IS NULL) as member_count,
           (SELECT count(DISTINCT tf.trip_id) FROM trip_families tf WHERE tf.family_id = f.id) as trip_count
    FROM families f
    LEFT JOIN users u ON f.admin_user_id = u.id
    LEFT JOIN persons p ON p.user_id = u.id
  `;
  const params: any[] = [];

  if (search) {
    query += ` WHERE (f.name LIKE ? OR u.email LIKE ? OR p.display_name LIKE ?)`;
    params.push(search, search, search);
  }

  query += ` ORDER BY f.created_at DESC`;

  const families = req.db.prepare(query).all(...params);
  res.json(families);
});

adminRouter.get('/families/:id', (req: Request, res: Response) => {
  const familyId = Number(req.params.id);
  const family = req.db.prepare(`
    SELECT f.*, u.email as admin_email, p.display_name as admin_name
    FROM families f
    LEFT JOIN users u ON f.admin_user_id = u.id
    LEFT JOIN persons p ON p.user_id = u.id
    WHERE f.id = ?
  `).get(familyId) as any;

  if (!family) {
    res.status(404).json({ error: 'NOT_FOUND', message: 'Family not found' });
    return;
  }

  const members = req.db.prepare(`
    SELECT fm.id as membership_id, fm.joined_at, fm.left_at,
           p.id as person_id, p.display_name, p.is_active as person_active,
           u.id as user_id, u.email, u.role
    FROM family_memberships fm
    JOIN persons p ON fm.person_id = p.id
    LEFT JOIN users u ON p.user_id = u.id
    WHERE fm.family_id = ?
    ORDER BY fm.left_at IS NULL DESC, p.display_name ASC
  `).all(familyId);

  const trips = req.db.prepare(`
    SELECT t.id, t.name, t.destination, t.start_date, t.end_date, t.status, t.is_private,
           (SELECT coalesce(sum(e.total_paise), 0) FROM expenses e WHERE e.trip_id = t.id AND e.voided_at IS NULL) as total_spent_paise
    FROM trip_families tf
    JOIN trips t ON tf.trip_id = t.id
    WHERE tf.family_id = ?
    ORDER BY t.created_at DESC
  `).all(familyId);

  res.json({
    family,
    members,
    trips,
  });
});

const createFamilySchema = z.object({
  name: z.string().min(2),
  admin_user_id: z.number().int().positive().optional().nullable(),
});

adminRouter.post('/families', (req: Request, res: Response) => {
  const parseResult = createFamilySchema.safeParse(req.body);
  if (!parseResult.success) {
    res.status(400).json({ error: 'VALIDATION_ERROR', details: parseResult.error.format() });
    return;
  }

  const { name, admin_user_id } = parseResult.data;
  const resId = req.db.prepare(`
    INSERT INTO families (name, admin_user_id, is_active)
    VALUES (?, ?, 1)
  `).run(name.trim(), admin_user_id || null);

  const familyId = Number(resId.lastInsertRowid);
  recordAuditLog(req.db, req.user!.id, 'ADMIN_CREATE_FAMILY', 'families', familyId, null, { name, admin_user_id });

  res.status(201).json({ id: familyId, name, admin_user_id });
});

const editFamilySchema = z.object({
  name: z.string().min(2).optional(),
  admin_user_id: z.number().int().positive().optional().nullable(),
  is_active: z.union([z.boolean(), z.number()]).optional(),
});

adminRouter.patch('/families/:id', (req: Request, res: Response) => {
  const familyId = Number(req.params.id);
  const existing = req.db.prepare('SELECT * FROM families WHERE id = ?').get(familyId) as any;
  if (!existing) {
    res.status(404).json({ error: 'NOT_FOUND', message: 'Family not found' });
    return;
  }

  const parseResult = editFamilySchema.safeParse(req.body);
  if (!parseResult.success) {
    res.status(400).json({ error: 'VALIDATION_ERROR', details: parseResult.error.format() });
    return;
  }

  const data = parseResult.data;
  const updatedName = data.name !== undefined ? data.name.trim() : existing.name;
  const updatedAdmin = data.admin_user_id !== undefined ? data.admin_user_id : existing.admin_user_id;
  const updatedActive = data.is_active !== undefined ? (Boolean(data.is_active) ? 1 : 0) : existing.is_active;

  req.db.prepare(`
    UPDATE families SET name = ?, admin_user_id = ?, is_active = ? WHERE id = ?
  `).run(updatedName, updatedAdmin, updatedActive, familyId);

  recordAuditLog(req.db, req.user!.id, 'ADMIN_UPDATE_FAMILY', 'families', familyId, existing, {
    name: updatedName,
    admin_user_id: updatedAdmin,
    is_active: updatedActive,
  });

  res.json({ message: 'Family updated successfully' });
});

// Add member to family
adminRouter.post('/families/:id/members', (req: Request, res: Response) => {
  const familyId = Number(req.params.id);
  const { person_id } = req.body;
  const personId = Number(person_id);

  if (!personId || isNaN(personId)) {
    res.status(400).json({ error: 'BAD_REQUEST', message: 'Valid person_id required' });
    return;
  }

  // Deactivate any existing active membership for this person
  req.db.prepare(`
    UPDATE family_memberships SET left_at = datetime('now') WHERE person_id = ? AND left_at IS NULL
  `).run(personId);

  const resId = req.db.prepare(`
    INSERT INTO family_memberships (family_id, person_id) VALUES (?, ?)
  `).run(familyId, personId);

  recordAuditLog(req.db, req.user!.id, 'ADMIN_ADD_FAMILY_MEMBER', 'family_memberships', Number(resId.lastInsertRowid), null, { familyId, personId });
  res.status(201).json({ message: 'Member added to family', id: Number(resId.lastInsertRowid) });
});

// Remove member from family
adminRouter.delete('/families/:id/members/:personId', (req: Request, res: Response) => {
  const familyId = Number(req.params.id);
  const personId = Number(req.params.personId);

  req.db.prepare(`
    UPDATE family_memberships SET left_at = datetime('now')
    WHERE family_id = ? AND person_id = ? AND left_at IS NULL
  `).run(familyId, personId);

  recordAuditLog(req.db, req.user!.id, 'ADMIN_REMOVE_FAMILY_MEMBER', 'family_memberships', null, { familyId, personId }, { left_at: new Date().toISOString() });
  res.json({ message: 'Member removed from family' });
});

// ----------------------------------------------------------------------------
// C. MEMBER MANAGEMENT (FEATURE 6.C)
// ----------------------------------------------------------------------------
adminRouter.get('/members', (req: Request, res: Response) => {
  const search = req.query.search ? `%${String(req.query.search).trim()}%` : null;

  let query = `
    SELECT u.id as user_id, u.email, u.role, u.is_active as user_active, u.created_at,
           p.id as person_id, p.display_name,
           f.id as family_id, f.name as family_name,
           (SELECT count(DISTINCT tp.trip_id) FROM trip_participants tp WHERE tp.person_id = p.id) as trip_count
    FROM users u
    LEFT JOIN persons p ON p.user_id = u.id
    LEFT JOIN family_memberships fm ON fm.person_id = p.id AND fm.left_at IS NULL
    LEFT JOIN families f ON fm.family_id = f.id
  `;
  const params: any[] = [];

  if (search) {
    query += ` WHERE (u.email LIKE ? OR p.display_name LIKE ? OR f.name LIKE ?)`;
    params.push(search, search, search);
  }

  query += ` ORDER BY u.created_at DESC`;

  const users = req.db.prepare(query).all(...params);
  // Never expose passwords or session tokens
  res.json(users);
});

// Activate or deactivate user account through controlled process
adminRouter.patch('/members/:userId/status', (req: Request, res: Response) => {
  const targetUserId = Number(req.params.userId);
  const { is_active } = req.body;

  if (is_active === undefined || (is_active !== 0 && is_active !== 1 && is_active !== true && is_active !== false)) {
    res.status(400).json({ error: 'BAD_REQUEST', message: 'Valid is_active (0 or 1) required' });
    return;
  }

  const activeNum = Boolean(is_active) ? 1 : 0;

  // Prevent super admin from disabling themselves
  if (targetUserId === req.user!.id && activeNum === 0) {
    res.status(400).json({ error: 'SELF_DEACTIVATION_PREVENTED', message: 'You cannot deactivate your own administrative account.' });
    return;
  }

  const targetUser = req.db.prepare('SELECT id, email, role, is_active FROM users WHERE id = ?').get(targetUserId) as any;
  if (!targetUser) {
    res.status(404).json({ error: 'NOT_FOUND', message: 'User not found' });
    return;
  }

  withTransaction(req.db, () => {
    req.db.prepare('UPDATE users SET is_active = ? WHERE id = ?').run(activeNum, targetUserId);

    // If deactivating, invalidate all active sessions for this user
    if (activeNum === 0) {
      revokeAllUserSessions(req.db, targetUserId);
    }

    recordAuditLog(req.db, req.user!.id, 'ADMIN_CHANGE_USER_STATUS', 'users', targetUserId, { is_active: targetUser.is_active }, { is_active: activeNum });
  });

  res.json({
    message: activeNum === 1 ? 'User activated successfully' : 'User deactivated and active sessions revoked',
    userId: targetUserId,
    is_active: activeNum,
  });
});

// Remove or deactivate user account safely without damaging financial history
adminRouter.delete('/members/:userId', (req: Request, res: Response) => {
  const targetUserId = Number(req.params.userId);

  if (!targetUserId || isNaN(targetUserId)) {
    res.status(400).json({ error: 'BAD_REQUEST', message: 'Valid user ID required' });
    return;
  }

  // Prevent super admin from deleting themselves
  if (targetUserId === req.user!.id) {
    res.status(400).json({ error: 'SELF_REMOVAL_PREVENTED', message: 'You cannot remove your own administrative account.' });
    return;
  }

  const targetUser = req.db.prepare('SELECT id, email, role, is_active FROM users WHERE id = ?').get(targetUserId) as any;
  if (!targetUser) {
    res.status(404).json({ error: 'NOT_FOUND', message: 'User not found' });
    return;
  }

  // Prevent removing the last remaining active super admin
  if (targetUser.role === 'super_admin') {
    const adminCount = (req.db.prepare(`SELECT count(*) as count FROM users WHERE role = 'super_admin' AND is_active = 1`).get() as { count: number }).count;
    if (adminCount <= 1) {
      res.status(400).json({ error: 'LAST_ADMIN_PREVENTED', message: 'Cannot remove the last remaining active Super Administrator.' });
      return;
    }
  }

  // Get associated person ID
  const person = req.db.prepare('SELECT id, display_name FROM persons WHERE user_id = ?').get(targetUserId) as { id: number; display_name: string } | undefined;
  const personId = person ? person.id : null;

  // Check for existing financial records or trip records
  let hasFinancialRecords = false;
  if (personId) {
    const expensePayerCount = (req.db.prepare(`SELECT count(*) as count FROM expenses WHERE paid_by_type = 'person' AND paid_by_id = ?`).get(personId) as { count: number }).count;
    const allocationCount = (req.db.prepare(`SELECT count(*) as count FROM expense_allocations WHERE account_type = 'person' AND account_id = ?`).get(personId) as { count: number }).count;
    const repaymentCount = (req.db.prepare(`SELECT count(*) as count FROM repayments WHERE (from_type = 'person' AND from_id = ?) OR (to_type = 'person' AND to_id = ?)`).get(personId, personId) as { count: number }).count;
    const creatorExpenseCount = (req.db.prepare(`SELECT count(*) as count FROM expenses WHERE created_by = ?`).get(targetUserId) as { count: number }).count;
    const creatorTripCount = (req.db.prepare(`SELECT count(*) as count FROM trips WHERE created_by = ?`).get(targetUserId) as { count: number }).count;

    if (expensePayerCount > 0 || allocationCount > 0 || repaymentCount > 0 || creatorExpenseCount > 0 || creatorTripCount > 0) {
      hasFinancialRecords = true;
    }
  }

  if (hasFinancialRecords) {
    // Financial records exist: deactivate account, revoke active sessions and family memberships to preserve historical integrity
    withTransaction(req.db, () => {
      req.db.prepare('UPDATE users SET is_active = 0 WHERE id = ?').run(targetUserId);
      if (personId) {
        req.db.prepare(`UPDATE family_memberships SET left_at = datetime('now') WHERE person_id = ? AND left_at IS NULL`).run(personId);
      }
      revokeAllUserSessions(req.db, targetUserId);

      recordAuditLog(req.db, req.user!.id, 'ADMIN_DEACTIVATE_USER_PRESERVE_FINANCIALS', 'users', targetUserId, {
        email: targetUser.email,
        is_active: targetUser.is_active,
      }, {
        is_active: 0,
        reason: 'User has financial history; preserved financial records and deactivated account.',
      });
    });

    res.json({
      action: 'deactivated',
      message: 'User account has existing financial history. Account has been deactivated and active sessions revoked to preserve historical financial integrity.',
      userId: targetUserId,
    });
    return;
  }

  // Zero financial records: safe to permanently delete user and related non-financial references
  withTransaction(req.db, () => {
    if (personId) {
      req.db.prepare('DELETE FROM family_memberships WHERE person_id = ?').run(personId);
      req.db.prepare('DELETE FROM trip_participants WHERE person_id = ?').run(personId);
      req.db.prepare('DELETE FROM persons WHERE id = ?').run(personId);
    }
    req.db.prepare('DELETE FROM notifications WHERE user_id = ?').run(targetUserId);
    req.db.prepare('DELETE FROM notification_preferences WHERE user_id = ?').run(targetUserId);
    req.db.prepare('DELETE FROM sessions WHERE user_id = ?').run(targetUserId);
    req.db.prepare('DELETE FROM users WHERE id = ?').run(targetUserId);

    recordAuditLog(req.db, req.user!.id, 'ADMIN_PERMANENT_DELETE_USER', 'users', targetUserId, {
      email: targetUser.email,
    }, null);
  });

  res.json({
    action: 'deleted',
    message: 'User had zero financial records and was permanently removed.',
    userId: targetUserId,
  });
});

// ----------------------------------------------------------------------------
// D. COMPLETE TRIP MANAGEMENT (FEATURE 6.D)
// ----------------------------------------------------------------------------
adminRouter.get('/trips', (req: Request, res: Response) => {
  const search = req.query.search ? `%${String(req.query.search).trim()}%` : null;
  const status = req.query.status ? String(req.query.status).trim() : null;

  let query = `
    SELECT t.id, t.name, t.destination, t.start_date, t.end_date, t.status, t.is_private,
           t.budget_paise, t.created_at, t.completed_at,
           u.email as creator_email,
           (SELECT count(*) FROM trip_participants tp WHERE tp.trip_id = t.id) as participant_count,
           (SELECT count(*) FROM expenses e WHERE e.trip_id = t.id AND e.voided_at IS NULL) as expense_count,
           (SELECT coalesce(sum(total_paise), 0) FROM expenses e WHERE e.trip_id = t.id AND e.voided_at IS NULL) as total_spent_paise
    FROM trips t
    LEFT JOIN users u ON t.created_by = u.id
    WHERE 1=1
  `;
  const params: any[] = [];

  if (search) {
    query += ` AND (t.name LIKE ? OR t.destination LIKE ? OR u.email LIKE ?)`;
    params.push(search, search, search);
  }
  if (status) {
    query += ` AND t.status = ?`;
    params.push(status);
  }

  query += ` ORDER BY t.created_at DESC`;

  const trips = req.db.prepare(query).all(...params);
  res.json(trips);
});

// Detailed trip inspector for Super Admin
adminRouter.get('/trips/:id', (req: Request, res: Response) => {
  const tripId = Number(req.params.id);
  const trip = req.db.prepare(`
    SELECT t.*, u.email as creator_email
    FROM trips t
    LEFT JOIN users u ON t.created_by = u.id
    WHERE t.id = ?
  `).get(tripId) as any;

  if (!trip) {
    res.status(404).json({ error: 'NOT_FOUND', message: 'Trip not found' });
    return;
  }

  // Families
  const families = req.db.prepare(`
    SELECT f.id, f.name, u.email as admin_email
    FROM trip_families tf
    JOIN families f ON tf.family_id = f.id
    LEFT JOIN users u ON f.admin_user_id = u.id
    WHERE tf.trip_id = ?
  `).all(tripId);

  // Participants & Attendance
  const participants = req.db.prepare(`
    SELECT p.id as person_id, p.display_name, tp.attendance, tp.responded_at,
           f.id as family_id, f.name as family_name,
           u.id as user_id, u.email
    FROM trip_participants tp
    JOIN persons p ON tp.person_id = p.id
    LEFT JOIN family_memberships fm ON fm.person_id = p.id AND fm.left_at IS NULL
    LEFT JOIN families f ON fm.family_id = f.id
    LEFT JOIN users u ON p.user_id = u.id
    WHERE tp.trip_id = ?
    ORDER BY p.display_name ASC
  `).all(tripId);

  // Invitations
  const invitations = req.db.prepare(`
    SELECT i.*, f.name as family_name, p.display_name as person_name, u.email as creator_email
    FROM invitations i
    LEFT JOIN families f ON i.family_id = f.id
    LEFT JOIN persons p ON i.person_id = p.id
    JOIN users u ON i.created_by = u.id
    WHERE i.trip_id = ?
  `).all(tripId);

  // Expenses with items and allocations
  const expenses = req.db.prepare(`
    SELECT e.*,
           CASE
             WHEN e.paid_by_type = 'person' THEN (SELECT display_name FROM persons WHERE id = e.paid_by_id)
             WHEN e.paid_by_type = 'family' THEN (SELECT name FROM families WHERE id = e.paid_by_id)
           END as payer_name,
           u.email as creator_email
    FROM expenses e
    JOIN users u ON e.created_by = u.id
    WHERE e.trip_id = ?
    ORDER BY e.expense_date DESC, e.id DESC
  `).all(tripId) as any[];

  for (const exp of expenses) {
    exp.items = req.db.prepare('SELECT * FROM expense_items WHERE expense_id = ?').all(exp.id);
    exp.charges = req.db.prepare('SELECT * FROM expense_charges WHERE expense_id = ?').all(exp.id);
    exp.allocations = req.db.prepare(`
      SELECT ea.*,
             CASE
               WHEN ea.account_type = 'person' THEN (SELECT display_name FROM persons WHERE id = ea.account_id)
               WHEN ea.account_type = 'family' THEN (SELECT name FROM families WHERE id = ea.account_id)
             END as account_name
      FROM expense_allocations ea
      WHERE ea.expense_id = ?
    `).all(exp.id);
  }

  // Repayments
  const repayments = req.db.prepare(`
    SELECT r.*,
           CASE
             WHEN r.from_type = 'person' THEN (SELECT display_name FROM persons WHERE id = r.from_id)
             WHEN r.from_type = 'family' THEN (SELECT name FROM families WHERE id = r.from_id)
           END as from_name,
           CASE
             WHEN r.to_type = 'person' THEN (SELECT display_name FROM persons WHERE id = r.to_id)
             WHEN r.to_type = 'family' THEN (SELECT name FROM families WHERE id = r.to_id)
           END as to_name,
           u.email as recorder_email
    FROM repayments r
    JOIN users u ON r.recorded_by = u.id
    WHERE r.trip_id = ?
    ORDER BY r.paid_on DESC, r.id DESC
  `).all(tripId);

  // Balances
  let balances: any[] = [];
  try {
    const { expenses: finExp, repayments: finRep, assumptions } = loadTripFinancialRecords(req.db, tripId);
    balances = Object.values(computeBalances(finExp, finRep, assumptions));
  } catch {
    // ignore
  }

  // Audit history
  const auditLogs = req.db.prepare(`
    SELECT al.*, u.email as actor_email
    FROM audit_log al
    LEFT JOIN users u ON al.actor_user_id = u.id
    WHERE (al.entity = 'trips' AND al.entity_id = ?)
       OR (al.entity = 'expenses' AND al.entity_id IN (SELECT id FROM expenses WHERE trip_id = ?))
       OR (al.entity = 'repayments' AND al.entity_id IN (SELECT id FROM repayments WHERE trip_id = ?))
    ORDER BY al.id DESC
    LIMIT 50
  `).all(tripId, tripId, tripId);

  res.json({
    trip,
    families,
    participants,
    invitations,
    expenses,
    repayments,
    balances,
    audit_logs: auditLogs,
  });
});

// ----------------------------------------------------------------------------
// E. EXPENSE AND SETTLEMENT MANAGEMENT (FEATURE 6.E)
// ----------------------------------------------------------------------------
adminRouter.get('/expenses', (req: Request, res: Response) => {
  const search = req.query.search ? `%${String(req.query.search).trim()}%` : null;
  const tripId = req.query.tripId ? Number(req.query.tripId) : null;

  let query = `
    SELECT e.id, e.trip_id, e.title, e.expense_date, e.category, e.total_paise,
           e.paid_by_type, e.paid_by_id, e.accounting_mode, e.split_method,
           e.voided_at, e.created_at,
           t.name as trip_name,
           CASE
             WHEN e.paid_by_type = 'person' THEN (SELECT display_name FROM persons WHERE id = e.paid_by_id)
             WHEN e.paid_by_type = 'family' THEN (SELECT name FROM families WHERE id = e.paid_by_id)
           END as payer_name,
           u.email as creator_email
    FROM expenses e
    JOIN trips t ON e.trip_id = t.id
    JOIN users u ON e.created_by = u.id
    WHERE 1=1
  `;
  const params: any[] = [];

  if (search) {
    query += ` AND (e.title LIKE ? OR t.name LIKE ? OR e.category LIKE ?)`;
    params.push(search, search, search);
  }
  if (tripId) {
    query += ` AND e.trip_id = ?`;
    params.push(tripId);
  }

  query += ` ORDER BY e.expense_date DESC, e.id DESC LIMIT 100`;

  const expenses = req.db.prepare(query).all(...params);
  res.json(expenses);
});

// Admin void expense
adminRouter.post('/expenses/:id/void', (req: Request, res: Response) => {
  const expenseId = Number(req.params.id);
  const expense = req.db.prepare('SELECT * FROM expenses WHERE id = ?').get(expenseId) as any;

  if (!expense) {
    res.status(404).json({ error: 'NOT_FOUND', message: 'Expense not found' });
    return;
  }

  if (expense.voided_at) {
    res.status(400).json({ error: 'ALREADY_VOIDED', message: 'This expense is already voided' });
    return;
  }

  const voidedAt = new Date().toISOString();
  req.db.prepare('UPDATE expenses SET voided_at = ? WHERE id = ?').run(voidedAt, expenseId);

  recordAuditLog(req.db, req.user!.id, 'ADMIN_VOID_EXPENSE', 'expenses', expenseId, { voided_at: null }, { voided_at: voidedAt });

  res.json({ message: 'Expense voided by Super Admin', voided_at: voidedAt });
});

// ----------------------------------------------------------------------------
// F. AUDIT LOGS (FEATURE 6.F)
// ----------------------------------------------------------------------------
adminRouter.get('/audit', (req: Request, res: Response) => {
  const limit = Math.min(100, Math.max(1, Number(req.query.limit || 50)));
  const offset = Math.max(0, Number(req.query.offset || 0));
  const entity = req.query.entity ? String(req.query.entity) : null;
  const action = req.query.action ? String(req.query.action) : null;

  let query = `
    SELECT al.id, al.actor_user_id, al.action, al.entity, al.entity_id,
           al.before_json, al.after_json, al.created_at,
           u.email as actor_email,
           p.display_name as actor_name
    FROM audit_log al
    LEFT JOIN users u ON al.actor_user_id = u.id
    LEFT JOIN persons p ON p.user_id = u.id
    WHERE 1=1
  `;
  const params: any[] = [];

  if (entity) {
    query += ` AND al.entity = ?`;
    params.push(entity);
  }
  if (action) {
    query += ` AND al.action LIKE ?`;
    params.push(`%${action}%`);
  }

  query += ` ORDER BY al.id DESC LIMIT ? OFFSET ?`;
  params.push(limit, offset);

  const logs = req.db.prepare(query).all(...params);
  const total = (req.db.prepare('SELECT count(*) as count FROM audit_log').get() as { count: number }).count;

  res.json({
    total,
    limit,
    offset,
    logs: logs.map((l: any) => ({
      ...l,
      before: l.before_json ? JSON.parse(l.before_json) : null,
      after: l.after_json ? JSON.parse(l.after_json) : null,
    })),
  });
});

// ----------------------------------------------------------------------------
// G. FAMILY INVITE CODES MANAGEMENT
// ----------------------------------------------------------------------------
adminRouter.get('/invite-codes', (req: Request, res: Response) => {
  const codes = req.db.prepare(`
    SELECT fic.id, fic.code, fic.family_id, fic.max_uses, fic.uses_count,
           (fic.max_uses - fic.uses_count) as remaining_uses,
           fic.expires_at, fic.status, fic.created_at, fic.notes,
           f.name as family_name,
           u.email as creator_email
    FROM family_invite_codes fic
    LEFT JOIN families f ON fic.family_id = f.id
    LEFT JOIN users u ON fic.created_by = u.id
    ORDER BY fic.created_at DESC
  `).all();

  res.json(codes);
});

const createInviteCodeSchema = z.object({
  code: z.string().trim().min(4).max(32).optional(),
  family_id: z.number().int().positive().nullable().optional(),
  max_uses: z.number().int().positive().optional().default(1),
  expires_at: z.string().nullable().optional(),
  notes: z.string().trim().max(255).optional(),
});

adminRouter.post('/invite-codes', (req: Request, res: Response) => {
  const parseResult = createInviteCodeSchema.safeParse(req.body);
  if (!parseResult.success) {
    res.status(400).json({ error: 'VALIDATION_ERROR', details: parseResult.error.format() });
    return;
  }

  const data = parseResult.data;
  let code = data.code ? data.code.toUpperCase() : '';

  if (!code) {
    // Generate secure random uppercase alphanumeric invite code
    code = 'FAM-' + crypto.randomBytes(4).toString('hex').toUpperCase();
  }

  // Check code uniqueness
  const existing = req.db.prepare('SELECT id FROM family_invite_codes WHERE code = ? COLLATE NOCASE').get(code);
  if (existing) {
    res.status(400).json({ error: 'CODE_EXISTS', message: 'An invite code with this text already exists. Please choose a unique code.' });
    return;
  }

  // If family_id provided, verify family exists
  if (data.family_id) {
    const fam = req.db.prepare('SELECT id, name FROM families WHERE id = ?').get(data.family_id);
    if (!fam) {
      res.status(404).json({ error: 'FAMILY_NOT_FOUND', message: 'Target family does not exist.' });
      return;
    }
  }

  const insertRes = req.db.prepare(`
    INSERT INTO family_invite_codes (code, family_id, max_uses, uses_count, expires_at, status, created_by, notes)
    VALUES (?, ?, ?, 0, ?, 'active', ?, ?)
  `).run(code, data.family_id || null, data.max_uses, data.expires_at || null, req.user!.id, data.notes || null);

  const newId = Number(insertRes.lastInsertRowid);

  recordAuditLog(req.db, req.user!.id, 'ADMIN_CREATE_FAMILY_INVITE_CODE', 'family_invite_codes', newId, null, {
    code,
    family_id: data.family_id,
    max_uses: data.max_uses,
    expires_at: data.expires_at,
  });

  const created = req.db.prepare(`
    SELECT fic.*, f.name as family_name
    FROM family_invite_codes fic
    LEFT JOIN families f ON fic.family_id = f.id
    WHERE fic.id = ?
  `).get(newId);

  res.status(201).json(created);
});

adminRouter.post('/invite-codes/:id/revoke', (req: Request, res: Response) => {
  const codeId = Number(req.params.id);
  const codeRow = req.db.prepare('SELECT * FROM family_invite_codes WHERE id = ?').get(codeId) as any;

  if (!codeRow) {
    res.status(404).json({ error: 'NOT_FOUND', message: 'Invite code not found' });
    return;
  }

  req.db.prepare(`UPDATE family_invite_codes SET status = 'revoked' WHERE id = ?`).run(codeId);

  recordAuditLog(req.db, req.user!.id, 'ADMIN_REVOKE_FAMILY_INVITE_CODE', 'family_invite_codes', codeId, {
    status: codeRow.status,
  }, {
    status: 'revoked',
  });

  res.json({ message: 'Invite code revoked successfully', id: codeId, status: 'revoked' });
});

// ==========================================
// SUGGESTIONS MANAGEMENT (SUPER ADMIN)
// ==========================================

// GET /api/admin/suggestions - List all submitted user suggestions
adminRouter.get('/suggestions', (req: Request, res: Response) => {
  const status = req.query.status as string | undefined;
  let query = `
    SELECT s.*, u.email as user_account_email
    FROM suggestions s
    JOIN users u ON s.user_id = u.id
  `;
  const params: any[] = [];
  if (status && ['pending', 'reviewed', 'resolved'].includes(status)) {
    query += ' WHERE s.status = ?';
    params.push(status);
  }
  query += ' ORDER BY s.created_at DESC';

  const suggestions = req.db.prepare(query).all(...params);
  res.json(suggestions);
});

// PATCH /api/admin/suggestions/:id - Update status (pending, reviewed, resolved) or admin notes
adminRouter.patch('/suggestions/:id', (req: Request, res: Response) => {
  const id = Number(req.params.id);
  const updateSchema = z.object({
    status: z.enum(['pending', 'reviewed', 'resolved']).optional(),
    admin_notes: z.string().optional().nullable(),
  });
  const parseResult = updateSchema.safeParse(req.body);
  if (!parseResult.success) {
    res.status(400).json({ error: 'VALIDATION_ERROR', details: parseResult.error.format() });
    return;
  }

  const current = req.db.prepare('SELECT * FROM suggestions WHERE id = ?').get(id) as any;
  if (!current) {
    res.status(404).json({ error: 'NOT_FOUND', message: 'Suggestion not found' });
    return;
  }

  const newStatus = parseResult.data.status || current.status;
  const newNotes = parseResult.data.admin_notes !== undefined ? parseResult.data.admin_notes : current.admin_notes;

  req.db.prepare(`
    UPDATE suggestions
    SET status = ?, admin_notes = ?, updated_at = datetime('now')
    WHERE id = ?
  `).run(newStatus, newNotes, id);

  const updated = req.db.prepare('SELECT * FROM suggestions WHERE id = ?').get(id);
  res.json({ message: 'Suggestion updated', suggestion: updated });
});

// DELETE /api/admin/suggestions/:id - Delete inappropriate suggestion
adminRouter.delete('/suggestions/:id', (req: Request, res: Response) => {
  const id = Number(req.params.id);
  const current = req.db.prepare('SELECT * FROM suggestions WHERE id = ?').get(id) as any;
  if (!current) {
    res.status(404).json({ error: 'NOT_FOUND', message: 'Suggestion not found' });
    return;
  }

  req.db.prepare('DELETE FROM suggestions WHERE id = ?').run(id);
  res.json({ message: 'Suggestion deleted successfully', id });
});
