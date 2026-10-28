import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { verifyPassword, hashPassword } from '../auth/password';
import { createSession, revokeSession } from '../auth/session';
import { hasSuperAdmin, createInitialSuperAdmin } from '../auth/setup';
import { requireAuth } from '../auth/middleware';
import { withTransaction } from '../db/connection';

export const authRouter = Router();

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const quickLoginSchema = z.object({
  email: z.string().email(),
});

const registerInviteSchema = z.object({
  invite_code: z.string().min(4),
  email: z.string().email(),
  password: z.string().min(6),
  displayName: z.string().min(2),
});

const setupAdminSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  displayName: z.string().min(2),
});

authRouter.get('/status', (req: Request, res: Response) => {
  const isSuperAdminConfigured = hasSuperAdmin(req.db);
  res.json({
    hasSuperAdmin: isSuperAdminConfigured,
    user: req.user || null,
    person: req.person || null,
    family: req.family || null,
  });
});

authRouter.post('/setup-admin', (req: Request, res: Response) => {
  if (hasSuperAdmin(req.db)) {
    res.status(400).json({ error: 'SUPER_ADMIN_EXISTS', message: 'A Super Admin already exists in the system' });
    return;
  }

  const parseResult = setupAdminSchema.safeParse(req.body);
  if (!parseResult.success) {
    res.status(400).json({ error: 'VALIDATION_ERROR', details: parseResult.error.format() });
    return;
  }

  const { email, password, displayName } = parseResult.data;
  try {
    const { user, person } = createInitialSuperAdmin(req.db, email, password, displayName);
    const session = createSession(req.db, user.id);

    res.cookie('session_token', session.token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 30 * 24 * 60 * 60 * 1000,
    });

    res.status(201).json({
      message: 'Super Admin successfully initialized',
      user,
      person,
      family: null,
      token: session.token,
    });
  } catch (err) {
    res.status(500).json({ error: 'SETUP_FAILED', message: (err as Error).message });
  }
});

authRouter.post('/login', (req: Request, res: Response) => {
  const parseResult = loginSchema.safeParse(req.body);
  if (!parseResult.success) {
    res.status(400).json({ error: 'VALIDATION_ERROR', details: parseResult.error.format() });
    return;
  }

  const { email, password } = parseResult.data;
  const userRow = req.db.prepare(`
    SELECT id, email, password_hash, role, is_active, created_at
    FROM users
    WHERE email = ? COLLATE NOCASE
  `).get(email) as { id: number; email: string; password_hash: string; role: string; is_active: number; created_at: string } | undefined;

  if (!userRow || userRow.is_active !== 1 || !verifyPassword(password, userRow.password_hash)) {
    res.status(401).json({ error: 'INVALID_CREDENTIALS', message: 'Invalid email or password' });
    return;
  }

  const session = createSession(req.db, userRow.id);

  res.cookie('session_token', session.token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 30 * 24 * 60 * 60 * 1000,
  });

  // Fetch person and family info
  const personRow = req.db.prepare(`
    SELECT id, display_name, user_id, is_active
    FROM persons
    WHERE user_id = ? AND is_active = 1
  `).get(userRow.id);

  let familyRow = null;
  if (personRow) {
    familyRow = req.db.prepare(`
      SELECT f.id, f.name, f.admin_user_id, f.is_active, f.created_at
      FROM families f
      JOIN family_memberships fm ON fm.family_id = f.id
      WHERE fm.person_id = ? AND fm.left_at IS NULL AND f.is_active = 1
      LIMIT 1
    `).get((personRow as { id: number }).id);
  }
  if (!familyRow) {
    familyRow = req.db.prepare(`
      SELECT id, name, admin_user_id, is_active, created_at
      FROM families
      WHERE admin_user_id = ? AND is_active = 1
      LIMIT 1
    `).get(userRow.id);
  }

  res.json({
    message: 'Login successful',
    token: session.token,
    user: {
      id: userRow.id,
      email: userRow.email,
      role: userRow.role,
      is_active: userRow.is_active,
      created_at: userRow.created_at,
    },
    person: personRow || null,
    family: familyRow || null,
  });
});

authRouter.post('/quick-login', (req: Request, res: Response) => {
  const parseResult = quickLoginSchema.safeParse(req.body);
  if (!parseResult.success) {
    res.status(400).json({ error: 'VALIDATION_ERROR', details: parseResult.error.format() });
    return;
  }

  const { email } = parseResult.data;
  const userRow = req.db.prepare(`
    SELECT id, email, password_hash, role, is_active, created_at
    FROM users
    WHERE email = ? COLLATE NOCASE
  `).get(email) as { id: number; email: string; password_hash: string; role: string; is_active: number; created_at: string } | undefined;

  if (!userRow || userRow.is_active !== 1) {
    res.status(401).json({ error: 'INVALID_CREDENTIALS', message: 'User not found or inactive' });
    return;
  }

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

  let familyRow = null;
  if (personRow) {
    familyRow = req.db.prepare(`
      SELECT f.id, f.name, f.admin_user_id, f.is_active, f.created_at
      FROM families f
      JOIN family_memberships fm ON fm.family_id = f.id
      WHERE fm.person_id = ? AND fm.left_at IS NULL AND f.is_active = 1
      LIMIT 1
    `).get((personRow as { id: number }).id);
  }
  if (!familyRow) {
    familyRow = req.db.prepare(`
      SELECT id, name, admin_user_id, is_active, created_at
      FROM families
      WHERE admin_user_id = ? AND is_active = 1
      LIMIT 1
    `).get(userRow.id);
  }

  res.json({
    message: 'Login successful',
    token: session.token,
    user: {
      id: userRow.id,
      email: userRow.email,
      role: userRow.role,
      is_active: userRow.is_active,
      created_at: userRow.created_at,
    },
    person: personRow || null,
    family: familyRow || null,
  });
});

authRouter.post('/register-invite', (req: Request, res: Response) => {
  const parseResult = registerInviteSchema.safeParse(req.body);
  if (!parseResult.success) {
    res.status(400).json({ error: 'VALIDATION_ERROR', details: parseResult.error.format() });
    return;
  }
  const { invite_code, email, password, displayName } = parseResult.data;

  const invite = req.db.prepare(`
    SELECT i.*, t.name as trip_name
    FROM invitations i
    JOIN trips t ON i.trip_id = t.id
    WHERE i.invite_code = ? COLLATE NOCASE AND i.status = 'pending'
  `).get(invite_code) as any;

  if (!invite) {
    res.status(404).json({ error: 'INVALID_INVITE', message: 'Invalid or expired invitation code' });
    return;
  }

  const existingUser = req.db.prepare('SELECT id FROM users WHERE email = ? COLLATE NOCASE').get(email);
  if (existingUser) {
    res.status(400).json({ error: 'USER_EXISTS', message: 'An account with this email already exists. Please sign in instead.' });
    return;
  }

  const hashedPassword = hashPassword(password);

  try {
    const result = withTransaction(req.db, () => {
      const userRes = req.db.prepare(`
        INSERT INTO users (email, password_hash, role)
        VALUES (?, ?, 'member')
      `).run(email, hashedPassword);
      const userId = Number(userRes.lastInsertRowid);

      const personRes = req.db.prepare(`
        INSERT INTO persons (display_name, user_id)
        VALUES (?, ?)
      `).run(displayName, userId);
      const personId = Number(personRes.lastInsertRowid);

      if (invite.family_id) {
        req.db.prepare(`
          INSERT INTO family_memberships (family_id, person_id)
          VALUES (?, ?)
        `).run(invite.family_id, personId);
      }

      req.db.prepare(`
        INSERT OR IGNORE INTO trip_participants (trip_id, person_id, attendance)
        VALUES (?, ?, 'coming')
      `).run(invite.trip_id, personId);

      req.db.prepare(`
        UPDATE invitations
        SET status = 'accepted', person_id = COALESCE(person_id, ?)
        WHERE id = ?
      `).run(personId, invite.id);

      const session = createSession(req.db, userId);

      res.cookie('session_token', session.token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 30 * 24 * 60 * 60 * 1000,
      });

      const user = { id: userId, email, role: 'member', is_active: 1 };
      const person = { id: personId, display_name: displayName, user_id: userId, is_active: 1 };
      let family = null;
      if (invite.family_id) {
        family = req.db.prepare('SELECT * FROM families WHERE id = ?').get(invite.family_id);
      }

      return { user, person, family, token: session.token };
    });

    res.status(201).json({
      message: 'Registration successful',
      token: result.token,
      user: result.user,
      person: result.person,
      family: result.family,
    });
  } catch (err: any) {
    res.status(500).json({ error: 'REGISTRATION_FAILED', message: err.message });
  }
});

authRouter.post('/logout', (req: Request, res: Response) => {
  if (req.sessionToken) {
    revokeSession(req.db, req.sessionToken);
  }
  res.clearCookie('session_token');
  res.json({ message: 'Logged out successfully' });
});

authRouter.get('/me', requireAuth, (req: Request, res: Response) => {
  res.json({
    user: req.user,
    person: req.person,
    family: req.family,
  });
});
