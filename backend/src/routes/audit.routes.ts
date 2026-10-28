import { Router, Request, Response } from 'express';
import { requireAuth, requireRole } from '../auth/middleware';

export const auditRouter = Router();

// GET /api/audit - Super Admin system audit log
auditRouter.get('/', requireAuth, requireRole('super_admin'), (req: Request, res: Response) => {
  const limit = Math.min(100, Math.max(1, Number(req.query.limit || 50)));
  const offset = Math.max(0, Number(req.query.offset || 0));

  const logs = req.db.prepare(`
    SELECT al.id, al.actor_user_id, al.action, al.entity, al.entity_id,
           al.before_json, al.after_json, al.created_at,
           u.email as actor_email
    FROM audit_log al
    LEFT JOIN users u ON al.actor_user_id = u.id
    ORDER BY al.id DESC
    LIMIT ? OFFSET ?
  `).all(limit, offset);

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
