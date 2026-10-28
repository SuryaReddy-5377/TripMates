import { DatabaseSync } from 'node:sqlite';

export function recordAuditLog(
  db: DatabaseSync,
  actorUserId: number | null,
  action: string,
  entity: string,
  entityId: number | null,
  beforeJson?: unknown,
  afterJson?: unknown
): void {
  try {
    db.prepare(`
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
  } catch (err) {
    console.error('Failed to write audit log:', err);
  }
}
