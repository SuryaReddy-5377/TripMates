import { AnyDb } from '../db/connection';

export function recordAuditLog(
  db: AnyDb | any,
  actorUserId: number | null,
  action: string,
  entity: string,
  entityId: number | null,
  beforeJson?: unknown,
  afterJson?: unknown
): any {
  try {
    const res = db.prepare(`
      INSERT INTO audit_log (actor_user_id, action, entity, entity_id, before_json, after_json)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      actorUserId,
      action,
      entity,
      entityId,
      beforeJson !== undefined ? JSON.stringify(beforeJson) : null,
      afterJson !== undefined ? JSON.stringify(afterJson) : null
    );

    if (res && typeof (res as any).catch === 'function') {
      (res as any).catch((err: any) => console.error('Failed to write audit log:', err));
    }
    return res;
  } catch (err) {
    console.error('Failed to write audit log:', err);
  }
}
