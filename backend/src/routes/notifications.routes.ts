import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { requireAuth } from '../auth/middleware';
import {
  getNotificationPreferences,
  updateNotificationPreferences,
} from '../notifications/service';

export const notificationsRouter = Router();

// GET /api/notifications - List user's notifications + unread count
notificationsRouter.get('/', requireAuth, (req: Request, res: Response) => {
  const userId = req.user!.id;
  const limit = Math.min(100, Math.max(1, Number(req.query.limit || 50)));
  const offset = Math.max(0, Number(req.query.offset || 0));
  const isReadFilter = req.query.is_read !== undefined ? (req.query.is_read === '1' ? 1 : 0) : null;

  let query = `
    SELECT id, user_id, type, title, message, trip_id, expense_id, repayment_id,
           data_json, is_read, read_at, event_key, created_at
    FROM notifications
    WHERE user_id = ?
  `;
  const params: any[] = [userId];

  if (isReadFilter !== null) {
    query += ` AND is_read = ?`;
    params.push(isReadFilter);
  }

  query += ` ORDER BY id DESC LIMIT ? OFFSET ?`;
  params.push(limit, offset);

  const rows = req.db.prepare(query).all(...params) as any[];

  // Unread count
  const unreadRow = req.db.prepare(`
    SELECT count(*) as count
    FROM notifications
    WHERE user_id = ? AND is_read = 0
  `).get(userId) as { count: number };

  const totalRow = req.db.prepare(`
    SELECT count(*) as count
    FROM notifications
    WHERE user_id = ?
  `).get(userId) as { count: number };

  const notifications = rows.map(r => ({
    ...r,
    data: r.data_json ? JSON.parse(r.data_json) : null,
  }));

  res.json({
    unread_count: unreadRow.count,
    total: totalRow.count,
    notifications,
  });
});

// PATCH /api/notifications/:id/read - Mark single notification as read
notificationsRouter.patch('/:id/read', requireAuth, (req: Request, res: Response) => {
  const userId = req.user!.id;
  const notifId = Number(req.params.id);

  if (!notifId || isNaN(notifId)) {
    res.status(400).json({ error: 'BAD_REQUEST', message: 'Valid notification ID required' });
    return;
  }

  // Security: only the owner of the notification can mark it as read
  const notif = req.db.prepare('SELECT id, user_id FROM notifications WHERE id = ?').get(notifId) as { id: number; user_id: number } | undefined;
  if (!notif) {
    res.status(404).json({ error: 'NOT_FOUND', message: 'Notification not found' });
    return;
  }

  if (notif.user_id !== userId) {
    res.status(403).json({ error: 'FORBIDDEN', message: 'You do not have access to this notification' });
    return;
  }

  const readAt = new Date().toISOString();
  req.db.prepare(`
    UPDATE notifications
    SET is_read = 1, read_at = ?
    WHERE id = ? AND user_id = ?
  `).run(readAt, notifId, userId);

  res.json({ message: 'Notification marked as read', id: notifId, read_at: readAt });
});

// POST /api/notifications/mark-all-read - Mark all notifications as read for current user
notificationsRouter.post('/mark-all-read', requireAuth, (req: Request, res: Response) => {
  const userId = req.user!.id;
  const readAt = new Date().toISOString();

  const result = req.db.prepare(`
    UPDATE notifications
    SET is_read = 1, read_at = ?
    WHERE user_id = ? AND is_read = 0
  `).run(readAt, userId);

  res.json({
    message: 'All notifications marked as read',
    updated_count: result.changes,
  });
});

// GET /api/notifications/preferences - Get notification preferences
notificationsRouter.get('/preferences', requireAuth, (req: Request, res: Response) => {
  const prefs = getNotificationPreferences(req.db, req.user!.id);
  res.json(prefs);
});

const updatePrefsSchema = z.object({
  trip_notifications: z.boolean().optional(),
  expense_notifications: z.boolean().optional(),
  repayment_notifications: z.boolean().optional(),
  browser_push_enabled: z.boolean().optional(),
  push_subscription_json: z.string().nullable().optional(),
});

// PUT /api/notifications/preferences - Update notification preferences
notificationsRouter.put('/preferences', requireAuth, (req: Request, res: Response) => {
  const parseResult = updatePrefsSchema.safeParse(req.body);
  if (!parseResult.success) {
    res.status(400).json({ error: 'VALIDATION_ERROR', details: parseResult.error.format() });
    return;
  }

  const data = parseResult.data;
  const updated = updateNotificationPreferences(req.db, req.user!.id, {
    trip_notifications: data.trip_notifications !== undefined ? (data.trip_notifications ? 1 : 0) : undefined,
    expense_notifications: data.expense_notifications !== undefined ? (data.expense_notifications ? 1 : 0) : undefined,
    repayment_notifications: data.repayment_notifications !== undefined ? (data.repayment_notifications ? 1 : 0) : undefined,
    browser_push_enabled: data.browser_push_enabled !== undefined ? (data.browser_push_enabled ? 1 : 0) : undefined,
    push_subscription_json: data.push_subscription_json,
  });

  res.json({
    message: 'Notification preferences updated',
    preferences: updated,
  });
});
