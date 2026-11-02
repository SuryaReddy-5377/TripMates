import crypto from 'node:crypto';
import { User, Person, Family, SessionData } from '../types';
import { AnyDb } from '../db/connection';

export function createSession(db: AnyDb | any, userId: number, durationDays = 30): any {
  const token = crypto.randomBytes(32).toString('hex');
  const expires = new Date();
  expires.setDate(expires.getDate() + durationDays);
  const expiresAt = expires.toISOString();

  const query = `
    INSERT INTO sessions (id, user_id, expires_at)
    VALUES (?, ?, ?)
  `;

  if (db && db.isPostgres) {
    return (async () => {
      await db.prepare(query).run(token, userId, expiresAt);
      return { token, expiresAt };
    })();
  }

  db.prepare(query).run(token, userId, expiresAt);
  return { token, expiresAt };
}

export function validateSession(db: AnyDb | any, token: string): any {
  if (!token) return null;

  const query = `
    SELECT s.id, s.user_id, s.expires_at, u.id as u_id, u.email, u.role, u.is_active, u.created_at
    FROM sessions s
    JOIN users u ON s.user_id = u.id
    WHERE s.id = ? AND datetime(s.expires_at) > datetime('now') AND u.is_active = 1
  `;

  if (db && db.isPostgres) {
    return (async (): Promise<SessionData | null> => {
      const sessionRow = (await db.prepare(query).get(token)) as any;
      if (!sessionRow) return null;

      const user: User = {
        id: sessionRow.u_id,
        email: sessionRow.email,
        role: sessionRow.role as User['role'],
        is_active: sessionRow.is_active,
        created_at: sessionRow.created_at,
      };

      const personRow = (await db.prepare(`
        SELECT id, display_name, user_id, is_active
        FROM persons
        WHERE user_id = ? AND is_active = 1
      `).get(user.id)) as any;

      const person: Person | null = personRow ? {
        id: personRow.id,
        display_name: personRow.display_name,
        user_id: personRow.user_id,
        is_active: personRow.is_active,
      } : null;

      let family: Family | null = null;
      if (person) {
        const famRow = (await db.prepare(`
          SELECT f.id, f.name, f.admin_user_id, f.is_active, f.created_at
          FROM families f
          JOIN family_memberships fm ON fm.family_id = f.id
          WHERE fm.person_id = ? AND fm.left_at IS NULL AND f.is_active = 1
          LIMIT 1
        `).get(person.id)) as any;
        if (famRow) family = famRow;
      }

      if (!family) {
        const adminFamRow = (await db.prepare(`
          SELECT id, name, admin_user_id, is_active, created_at
          FROM families
          WHERE admin_user_id = ? AND is_active = 1
          LIMIT 1
        `).get(user.id)) as any;
        if (adminFamRow) family = adminFamRow;
      }

      return { user, person, family };
    })();
  }

  // SQLite synchronous path
  const sessionRow = db.prepare(query).get(token) as any;
  if (!sessionRow) return null;

  const user: User = {
    id: sessionRow.u_id,
    email: sessionRow.email,
    role: sessionRow.role as User['role'],
    is_active: sessionRow.is_active,
    created_at: sessionRow.created_at,
  };

  const personRow = db.prepare(`
    SELECT id, display_name, user_id, is_active
    FROM persons
    WHERE user_id = ? AND is_active = 1
  `).get(user.id) as any;

  const person: Person | null = personRow ? {
    id: personRow.id,
    display_name: personRow.display_name,
    user_id: personRow.user_id,
    is_active: personRow.is_active,
  } : null;

  let family: Family | null = null;
  if (person) {
    const famRow = db.prepare(`
      SELECT f.id, f.name, f.admin_user_id, f.is_active, f.created_at
      FROM families f
      JOIN family_memberships fm ON fm.family_id = f.id
      WHERE fm.person_id = ? AND fm.left_at IS NULL AND f.is_active = 1
      LIMIT 1
    `).get(person.id) as any;
    if (famRow) family = famRow;
  }

  if (!family) {
    const adminFamRow = db.prepare(`
      SELECT id, name, admin_user_id, is_active, created_at
      FROM families
      WHERE admin_user_id = ? AND is_active = 1
      LIMIT 1
    `).get(user.id) as any;
    if (adminFamRow) family = adminFamRow;
  }

  return { user, person, family };
}

export function revokeSession(db: AnyDb | any, token: string): any {
  if (!token) return;
  if (db && db.isPostgres) {
    return db.prepare('DELETE FROM sessions WHERE id = ?').run(token);
  }
  db.prepare('DELETE FROM sessions WHERE id = ?').run(token);
}

export function revokeAllUserSessions(db: AnyDb | any, userId: number): any {
  if (db && db.isPostgres) {
    return db.prepare('DELETE FROM sessions WHERE user_id = ?').run(userId);
  }
  db.prepare('DELETE FROM sessions WHERE user_id = ?').run(userId);
}
