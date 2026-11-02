import { hashPassword } from './password';
import { withTransaction, AnyDb } from '../db/connection';
import { recordAuditLog } from './audit';
import { User, Person } from '../types';

export function hasSuperAdmin(db: AnyDb | any): any {
  const query = `SELECT COUNT(*) as count FROM users WHERE role = 'super_admin' AND is_active = 1`;
  if (db && db.isPostgres) {
    return (async (): Promise<boolean> => {
      const row = (await db.prepare(query).get()) as { count: number | string };
      return Number(row?.count || 0) > 0;
    })();
  }
  const row = db.prepare(query).get() as { count: number };
  return Number(row?.count || 0) > 0;
}

export function createInitialSuperAdmin(
  db: AnyDb | any,
  email: string,
  password: string,
  displayName: string
): any {
  const cleanEmail = email.trim().toLowerCase();
  if (!cleanEmail || !cleanEmail.includes('@')) {
    throw new Error('Valid email address is required.');
  }
  if (!password || password.length < 6) {
    throw new Error('Password must be at least 6 characters long.');
  }
  const cleanName = displayName.trim();
  if (!cleanName) {
    throw new Error('Display name is required.');
  }

  const passwordHash = hashPassword(password);

  if (db && db.isPostgres) {
    return (async () => {
      const exists = await hasSuperAdmin(db);
      if (exists) {
        throw new Error('A Super Admin is already configured for this system.');
      }

      return withTransaction(db, async () => {
        const userRes = await db.prepare(`
          INSERT INTO users (email, password_hash, role, is_active)
          VALUES (?, ?, 'super_admin', 1)
        `).run(cleanEmail, passwordHash);

        const userId = Number(userRes.lastInsertRowid);

        const personRes = await db.prepare(`
          INSERT INTO persons (display_name, user_id, is_active)
          VALUES (?, ?, 1)
        `).run(cleanName, userId);

        const personId = Number(personRes.lastInsertRowid);

        await recordAuditLog(db, userId, 'SETUP_INITIAL_SUPER_ADMIN', 'users', userId, null, { email: cleanEmail, role: 'super_admin' });

        const user: User = {
          id: userId,
          email: cleanEmail,
          role: 'super_admin',
          is_active: 1,
          created_at: new Date().toISOString(),
        };

        const person: Person = {
          id: personId,
          display_name: cleanName,
          user_id: userId,
          is_active: 1,
        };

        return { user, person };
      });
    })();
  }

  // SQLite synchronous path
  if (hasSuperAdmin(db)) {
    throw new Error('A Super Admin is already configured for this system.');
  }

  return withTransaction(db, () => {
    const userRes = db.prepare(`
      INSERT INTO users (email, password_hash, role, is_active)
      VALUES (?, ?, 'super_admin', 1)
    `).run(cleanEmail, passwordHash);

    const userId = Number(userRes.lastInsertRowid);

    const personRes = db.prepare(`
      INSERT INTO persons (display_name, user_id, is_active)
      VALUES (?, ?, 1)
    `).run(cleanName, userId);

    const personId = Number(personRes.lastInsertRowid);

    recordAuditLog(db, userId, 'SETUP_INITIAL_SUPER_ADMIN', 'users', userId, null, { email: cleanEmail, role: 'super_admin' });

    const user: User = {
      id: userId,
      email: cleanEmail,
      role: 'super_admin',
      is_active: 1,
      created_at: new Date().toISOString(),
    };

    const person: Person = {
      id: personId,
      display_name: cleanName,
      user_id: userId,
      is_active: 1,
    };

    return { user, person };
  });
}
