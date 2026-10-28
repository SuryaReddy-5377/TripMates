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

  // 1. Check family_invite_codes table first
  const famCode = req.db.prepare(`
    SELECT * FROM family_invite_codes
    WHERE code = ? COLLATE NOCASE
  `).get(invite_code) as any;

  if (famCode) {
    if (famCode.status !== 'active') {
      res.status(400).json({ error: 'CODE_INACTIVE', message: 'This family invite code has been revoked or exhausted.' });
      return;
    }
    if (famCode.expires_at && new Date(famCode.expires_at) < new Date()) {
      res.status(400).json({ error: 'CODE_EXPIRED', message: 'This family invite code has expired.' });
      return;
    }
    if (famCode.uses_count >= famCode.max_uses) {
      res.status(400).json({ error: 'CODE_EXHAUSTED', message: 'This family invite code has reached its maximum usage limit.' });
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
        // Concurrency-safe atomic check and update of usage limit inside transaction
        const updated = req.db.prepare(`
          UPDATE family_invite_codes
          SET uses_count = uses_count + 1,
              status = CASE WHEN uses_count + 1 >= max_uses THEN 'exhausted' ELSE status END
          WHERE id = ? AND status = 'active' AND uses_count < max_uses
        `).run(famCode.id);

        if (updated.changes === 0) {
          throw new Error('This invite code usage limit was exceeded or is no longer active.');
        }

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

        let family = null;
        if (famCode.family_id) {
          req.db.prepare(`
            INSERT INTO family_memberships (family_id, person_id)
            VALUES (?, ?)
          `).run(famCode.family_id, personId);
          family = req.db.prepare('SELECT * FROM families WHERE id = ?').get(famCode.family_id);
        }

        const session = createSession(req.db, userId);

        res.cookie('session_token', session.token, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax',
          maxAge: 30 * 24 * 60 * 60 * 1000,
        });

        const user = { id: userId, email, role: 'member', is_active: 1 };
        const person = { id: personId, display_name: displayName, user_id: userId, is_active: 1 };

        return { user, person, family, token: session.token };
      });

      res.status(201).json({
        message: 'Registration successful',
        token: result.token,
        user: result.user,
        person: result.person,
        family: result.family,
      });
      return;
    } catch (err: any) {
      res.status(400).json({ error: 'REGISTRATION_FAILED', message: err.message });
      return;
    }
  }

  // 2. Fall back to existing trip-based invitations
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

// GET /api/auth/profile - Full profile including family members breakdown
authRouter.get('/profile', requireAuth, (req: Request, res: Response) => {
  const user = req.user!;
  const person = req.person!;
  const family = req.family;

  let familyMembers: any[] = [];
  if (family) {
    familyMembers = req.db.prepare(`
      SELECT p.id, p.display_name, p.user_id, p.is_active, u.email, fm.joined_at,
             CASE WHEN f.admin_user_id = p.user_id THEN 1 ELSE 0 END as is_family_admin,
             CASE WHEN p.id = ? THEN 1 ELSE 0 END as is_current_user
      FROM family_memberships fm
      JOIN persons p ON fm.person_id = p.id
      LEFT JOIN users u ON p.user_id = u.id
      JOIN families f ON fm.family_id = f.id
      WHERE fm.family_id = ? AND fm.left_at IS NULL AND p.is_active = 1
      ORDER BY p.id ASC
    `).all(person?.id ?? -1, family.id);
  }

  res.json({
    user: {
      id: user.id,
      email: user.email,
      role: user.role,
      is_active: user.is_active,
      created_at: user.created_at,
    },
    person,
    family,
    familyMembers,
  });
});

// POST /api/auth/profile/family - Create or update family name
authRouter.post('/profile/family', requireAuth, (req: Request, res: Response) => {
  const { name } = req.body;
  if (!name || typeof name !== 'string' || name.trim().length < 2) {
    res.status(400).json({ error: 'INVALID_NAME', message: 'Family name must be at least 2 characters long' });
    return;
  }

  const trimmedName = name.trim();
  const user = req.user!;
  const person = req.person!;

  try {
    const updatedFamily = withTransaction(req.db, () => {
      let family = req.family;
      if (family) {
        // Update existing family name
        req.db.prepare(`UPDATE families SET name = ? WHERE id = ?`).run(trimmedName, family.id);
        return { ...family, name: trimmedName };
      } else {
        // Create new family for this user
        const famRes = req.db.prepare(`
          INSERT INTO families (name, admin_user_id, is_active)
          VALUES (?, ?, 1)
        `).run(trimmedName, user.id);
        const familyId = Number(famRes.lastInsertRowid);

        if (person) {
          req.db.prepare(`
            INSERT OR IGNORE INTO family_memberships (family_id, person_id)
            VALUES (?, ?)
          `).run(familyId, person.id);
        }

        // Elevate user role to family_admin if currently standard member
        if (user.role === 'member') {
          req.db.prepare(`UPDATE users SET role = 'family_admin' WHERE id = ?`).run(user.id);
        }

        return { id: familyId, name: trimmedName, admin_user_id: user.id, is_active: 1 };
      }
    });

    res.json({ message: 'Family saved successfully', family: updatedFamily });
  } catch (err: any) {
    res.status(500).json({ error: 'FAMILY_UPDATE_FAILED', message: err.message });
  }
});

// POST /api/auth/profile/family/members - Add a family member (spouse, child, etc.)
authRouter.post('/profile/family/members', requireAuth, (req: Request, res: Response) => {
  const { display_name, email, password } = req.body;
  if (!display_name || typeof display_name !== 'string' || display_name.trim().length < 2) {
    res.status(400).json({ error: 'INVALID_NAME', message: 'Display name must be at least 2 characters' });
    return;
  }

  const user = req.user!;
  const person = req.person!;
  let family = req.family;

  try {
    const createdMember = withTransaction(req.db, () => {
      // If user doesn't have a family yet, auto-create one based on their name
      if (!family) {
        const defaultFamName = `${person?.display_name || user.email.split('@')[0]}'s Family`;
        const famRes = req.db.prepare(`
          INSERT INTO families (name, admin_user_id, is_active)
          VALUES (?, ?, 1)
        `).run(defaultFamName, user.id);
        const famId = Number(famRes.lastInsertRowid);

        if (person) {
          req.db.prepare(`
            INSERT OR IGNORE INTO family_memberships (family_id, person_id)
            VALUES (?, ?)
          `).run(famId, person.id);
        }

        family = { id: famId, name: defaultFamName, admin_user_id: user.id, is_active: 1 } as any;
      }

      let newUserId: number | null = null;
      if (email && password) {
        const existing = req.db.prepare('SELECT id FROM users WHERE email = ? COLLATE NOCASE').get(email);
        if (existing) {
          throw new Error(`Email ${email} is already in use`);
        }
        const pwdHash = hashPassword(password);
        const uRes = req.db.prepare(`
          INSERT INTO users (email, password_hash, role, is_active)
          VALUES (?, ?, 'member', 1)
        `).run(email, pwdHash);
        newUserId = Number(uRes.lastInsertRowid);
      }

      const pRes = req.db.prepare(`
        INSERT INTO persons (display_name, user_id, is_active)
        VALUES (?, ?, 1)
      `).run(display_name.trim(), newUserId);
      const newPersonId = Number(pRes.lastInsertRowid);

      req.db.prepare(`
        INSERT INTO family_memberships (family_id, person_id)
        VALUES (?, ?)
      `).run(family!.id, newPersonId);

      return {
        id: newPersonId,
        display_name: display_name.trim(),
        user_id: newUserId,
        email: email || null,
        family_id: family!.id,
      };
    });

    res.status(201).json({ message: 'Family member added successfully', member: createdMember });
  } catch (err: any) {
    res.status(400).json({ error: 'MEMBER_ADD_FAILED', message: err.message });
  }
});

// DELETE /api/auth/profile/family/members/:personId - Remove member from family
authRouter.delete('/profile/family/members/:personId', requireAuth, (req: Request, res: Response) => {
  const targetPersonId = Number(req.params.personId);
  const user = req.user!;
  const person = req.person!;
  const family = req.family;

  if (!family) {
    res.status(400).json({ error: 'NO_FAMILY', message: 'You do not belong to a family' });
    return;
  }

  if (person && person.id === targetPersonId) {
    res.status(400).json({ error: 'CANNOT_REMOVE_SELF', message: 'You cannot remove yourself from your family' });
    return;
  }

  // Ensure target belongs to user's family
  const membership = req.db.prepare(`
    SELECT id FROM family_memberships
    WHERE family_id = ? AND person_id = ? AND left_at IS NULL
  `).get(family.id, targetPersonId);

  if (!membership) {
    res.status(404).json({ error: 'NOT_FOUND', message: 'Member not found in your family' });
    return;
  }

  // Check if they are involved in trip expenses
  const hasExpenses = req.db.prepare(`
    SELECT 1 FROM expense_allocations WHERE account_type = 'person' AND account_id = ?
    UNION
    SELECT 1 FROM expenses WHERE paid_by_type = 'person' AND paid_by_id = ?
    LIMIT 1
  `).get(targetPersonId, targetPersonId);

  if (hasExpenses) {
    // Soft remove: set left_at
    req.db.prepare(`
      UPDATE family_memberships
      SET left_at = datetime('now')
      WHERE family_id = ? AND person_id = ?
    `).run(family.id, targetPersonId);
  } else {
    // Delete membership
    req.db.prepare(`
      DELETE FROM family_memberships
      WHERE family_id = ? AND person_id = ?
    `).run(family.id, targetPersonId);
  }

  res.json({ message: 'Member removed from family' });
});
