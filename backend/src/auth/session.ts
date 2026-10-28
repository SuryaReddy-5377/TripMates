import { DatabaseSync } from 'node:sqlite';
import crypto from 'node:crypto';
import { User, Person, Family, SessionData } from '../types';

export function createSession(db: DatabaseSync, userId: number, durationDays = 30): { token: string; expiresAt: string } {
  const token = crypto.randomBytes(32).toString('hex');
  const expires = new Date();
  expires.setDate(expires.getDate() + durationDays);
  const expiresAt = expires.toISOString();

  db.prepare(`
    INSERT INTO sessions (id, user_id, expires_at)
    VALUES (?, ?, ?)
  `).run(token, userId, expiresAt);

  return { token, expiresAt };
}

export function validateSession(db: DatabaseSync, token: string): SessionData | null {
  if (!token) return null;

  const sessionRow = db.prepare(`
    SELECT s.id, s.user_id, s.expires_at, u.id as u_id, u.email, u.role, u.is_active, u.created_at
    FROM sessions s
    JOIN users u ON s.user_id = u.id
    WHERE s.id = ? AND datetime(s.expires_at) > datetime('now') AND u.is_active = 1
  `).get(token) as {
    id: string;
    user_id: number;
    expires_at: string;
    u_id: number;
    email: string;
    role: string;
    is_active: number;
    created_at: string;
  } | undefined;

  if (!sessionRow) return null;

  const user: User = {
    id: sessionRow.u_id,
    email: sessionRow.email,
    role: sessionRow.role as User['role'],
    is_active: sessionRow.is_active,
    created_at: sessionRow.created_at,
  };

  // Find linked person
  const personRow = db.prepare(`
    SELECT id, display_name, user_id, is_active
    FROM persons
    WHERE user_id = ? AND is_active = 1
  `).get(user.id) as { id: number; display_name: string; user_id: number; is_active: number } | undefined;

  const person: Person | null = personRow ? {
    id: personRow.id,
    display_name: personRow.display_name,
    user_id: personRow.user_id,
    is_active: personRow.is_active,
  } : null;

  // Find linked family (either through person's active membership, or if family admin)
  let family: Family | null = null;
  if (person) {
    const famRow = db.prepare(`
      SELECT f.id, f.name, f.admin_user_id, f.is_active, f.created_at
      FROM families f
      JOIN family_memberships fm ON fm.family_id = f.id
      WHERE fm.person_id = ? AND fm.left_at IS NULL AND f.is_active = 1
      LIMIT 1
    `).get(person.id) as { id: number; name: string; admin_user_id: number | null; is_active: number; created_at: string } | undefined;

    if (famRow) {
      family = famRow;
    }
  }

  if (!family) {
    const adminFamRow = db.prepare(`
      SELECT id, name, admin_user_id, is_active, created_at
      FROM families
      WHERE admin_user_id = ? AND is_active = 1
      LIMIT 1
    `).get(user.id) as { id: number; name: string; admin_user_id: number | null; is_active: number; created_at: string } | undefined;

    if (adminFamRow) {
      family = adminFamRow;
    }
  }

  return { user, person, family };
}

export function revokeSession(db: DatabaseSync, token: string): void {
  if (token) {
    db.prepare('DELETE FROM sessions WHERE id = ?').run(token);
  }
}

export function revokeAllUserSessions(db: DatabaseSync, userId: number): void {
  db.prepare('DELETE FROM sessions WHERE user_id = ?').run(userId);
}
