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
  invite_code: z.string().optional().nullable(),
  inviteCode: z.string().optional().nullable(),
  email: z.string().email(),
  password: z.string().min(6),
  displayName: z.string().min(2),
});

const registerSchema = registerInviteSchema;

const setupAdminSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  displayName: z.string().min(2),
});

authRouter.get('/status', async (req: Request, res: Response) => {
  const isSuperAdminConfigured = await hasSuperAdmin(req.db);
  res.json({
    hasSuperAdmin: Boolean(isSuperAdminConfigured),
    user: req.user || null,
    person: req.person || null,
    family: req.family || null,
  });
});

authRouter.post('/setup-admin', async (req: Request, res: Response) => {
  if (await hasSuperAdmin(req.db)) {
    res.status(403).json({
      error: 'SETUP_DISABLED',
      message: 'Initial Super Admin setup is permanently disabled because a Super Admin is already configured in the system.',
    });
    return;
  }

  const parseResult = setupAdminSchema.safeParse(req.body);
  if (!parseResult.success) {
    res.status(400).json({ error: 'VALIDATION_ERROR', details: parseResult.error.format() });
    return;
  }

  const { email, password, displayName } = parseResult.data;
  try {
    const { user, person } = await createInitialSuperAdmin(req.db, email, password, displayName);
    const session = await createSession(req.db, user.id);

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

const handleLogin = async (req: Request, res: Response) => {
  const parseResult = loginSchema.safeParse(req.body);
  if (!parseResult.success) {
    res.status(400).json({ error: 'VALIDATION_ERROR', details: parseResult.error.format() });
    return;
  }

  const { email, password } = parseResult.data;
  const userRow = (await req.db.prepare(`
    SELECT id, email, password_hash, role, is_active, created_at
    FROM users
    WHERE email = ? COLLATE NOCASE
  `).get(email)) as { id: number; email: string; password_hash: string; role: string; is_active: number; created_at: string } | undefined;

  if (!userRow || userRow.is_active !== 1 || !verifyPassword(password, userRow.password_hash)) {
    res.status(401).json({ error: 'INVALID_CREDENTIALS', message: 'Invalid email or password' });
    return;
  }

  const session = await createSession(req.db, userRow.id);

  res.cookie('session_token', session.token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 30 * 24 * 60 * 60 * 1000,
  });

  // Fetch person and family info
  const personRow = await req.db.prepare(`
    SELECT id, display_name, user_id, is_active
    FROM persons
    WHERE user_id = ? AND is_active = 1
  `).get(userRow.id);

  let familyRow = null;
  if (personRow) {
    familyRow = await req.db.prepare(`
      SELECT f.id, f.name, f.admin_user_id, f.is_active, f.created_at
      FROM families f
      JOIN family_memberships fm ON fm.family_id = f.id
      WHERE fm.person_id = ? AND fm.left_at IS NULL AND f.is_active = 1
      LIMIT 1
    `).get((personRow as { id: number }).id);
  }
  if (!familyRow) {
    familyRow = await req.db.prepare(`
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
};

authRouter.post('/login', handleLogin);
authRouter.post('/signin', handleLogin);

authRouter.post('/quick-login', async (req: Request, res: Response) => {
  const parseResult = quickLoginSchema.safeParse(req.body);
  if (!parseResult.success) {
    res.status(400).json({ error: 'VALIDATION_ERROR', details: parseResult.error.format() });
    return;
  }

  const { email } = parseResult.data;
  const userRow = (await req.db.prepare(`
    SELECT id, email, password_hash, role, is_active, created_at
    FROM users
    WHERE email = ? COLLATE NOCASE
  `).get(email)) as { id: number; email: string; password_hash: string; role: string; is_active: number; created_at: string } | undefined;

  if (!userRow || userRow.is_active !== 1) {
    res.status(401).json({ error: 'INVALID_CREDENTIALS', message: 'User not found or inactive' });
    return;
  }

  const session = await createSession(req.db, userRow.id);

  res.cookie('session_token', session.token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 30 * 24 * 60 * 60 * 1000,
  });

  const personRow = await req.db.prepare(`
    SELECT id, display_name, user_id, is_active
    FROM persons
    WHERE user_id = ? AND is_active = 1
  `).get(userRow.id);

  let familyRow = null;
  if (personRow) {
    familyRow = await req.db.prepare(`
      SELECT f.id, f.name, f.admin_user_id, f.is_active, f.created_at
      FROM families f
      JOIN family_memberships fm ON fm.family_id = f.id
      WHERE fm.person_id = ? AND fm.left_at IS NULL AND f.is_active = 1
      LIMIT 1
    `).get((personRow as { id: number }).id);
  }
  if (!familyRow) {
    familyRow = await req.db.prepare(`
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

const handleRegister = async (req: Request, res: Response) => {
  const parseResult = registerSchema.safeParse(req.body);
  if (!parseResult.success) {
    res.status(400).json({ error: 'VALIDATION_ERROR', details: parseResult.error.format() });
    return;
  }
  const { email, password, displayName } = parseResult.data;
  const rawCode = parseResult.data.invite_code || parseResult.data.inviteCode || req.body.invite_code || req.body.inviteCode;
  const cleanCode = typeof rawCode === 'string' ? rawCode.trim().toUpperCase() : '';

  // 1. Strict Email Uniqueness Check across all registration paths
  const existingUser = await req.db.prepare('SELECT id FROM users WHERE email = ? COLLATE NOCASE').get(email);
  if (existingUser) {
    res.status(400).json({
      error: 'USER_EXISTS',
      message: 'An account with this email already exists. Please sign in with your password instead.',
    });
    return;
  }

  // 2. Validate Invitation Code (if supplied)
  if (cleanCode.length > 0) {
    // 2a. Check family_invite_codes table first (Super Admin generated codes)
    const famCode = (await req.db.prepare(`
      SELECT * FROM family_invite_codes
      WHERE code = ? COLLATE NOCASE
    `).get(cleanCode)) as any;

    if (famCode) {
      if (famCode.status === 'revoked') {
        res.status(400).json({ error: 'CODE_REVOKED', message: 'This invitation code has been revoked by an administrator.' });
        return;
      }
      if (famCode.status === 'exhausted' || famCode.uses_count >= famCode.max_uses) {
        res.status(400).json({ error: 'CODE_INACTIVE', reason: 'exhausted', message: 'This invitation code has reached its maximum usage limit.' });
        return;
      }
      if (famCode.status !== 'active') {
        res.status(400).json({ error: 'CODE_INACTIVE', message: 'This invitation code is currently inactive.' });
        return;
      }
      if (famCode.expires_at) {
        const expTime = famCode.expires_at.includes('T')
          ? new Date(famCode.expires_at).getTime()
          : new Date(`${famCode.expires_at}T23:59:59.999Z`).getTime();
        if (expTime < Date.now()) {
          res.status(400).json({ error: 'CODE_EXPIRED', message: 'This invitation code has expired.' });
          return;
        }
      }

      const hashedPassword = hashPassword(password);

      try {
        const result = await withTransaction(req.db, async () => {
          // Concurrency-safe atomic check and update of usage limit inside transaction
          const updated = await req.db.prepare(`
            UPDATE family_invite_codes
            SET uses_count = uses_count + 1,
                status = CASE WHEN uses_count + 1 >= max_uses THEN 'exhausted' ELSE status END
            WHERE id = ? AND status = 'active' AND uses_count < max_uses
          `).run(famCode.id);

          if (updated.changes === 0) {
            throw new Error('This invitation code usage limit was reached or is no longer active.');
          }

          const userRes = await req.db.prepare(`
            INSERT INTO users (email, password_hash, role)
            VALUES (?, ?, 'member')
          `).run(email, hashedPassword);
          const userId = Number(userRes.lastInsertRowid);

          const personRes = await req.db.prepare(`
            INSERT INTO persons (display_name, user_id)
            VALUES (?, ?)
          `).run(displayName, userId);
          const personId = Number(personRes.lastInsertRowid);

          let family = null;
          if (famCode.family_id) {
            await req.db.prepare(`
              INSERT INTO family_memberships (family_id, person_id)
              VALUES (?, ?)
            `).run(famCode.family_id, personId);
            family = await req.db.prepare('SELECT * FROM families WHERE id = ?').get(famCode.family_id);
          } else {
            // If invite code was created globally without a family, create a personal family
            const famName = `${displayName}'s Family`;
            const famRes = await req.db.prepare(`
              INSERT INTO families (name, admin_user_id)
              VALUES (?, ?)
            `).run(famName, userId);
            const familyId = Number(famRes.lastInsertRowid);
            await req.db.prepare(`
              INSERT INTO family_memberships (family_id, person_id)
              VALUES (?, ?)
            `).run(familyId, personId);
            family = await req.db.prepare('SELECT * FROM families WHERE id = ?').get(familyId);
          }

          const session = await createSession(req.db, userId);

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

    // 2b. Check trip-based invitations table
    const invite = (await req.db.prepare(`
      SELECT i.*, t.name as trip_name
      FROM invitations i
      LEFT JOIN trips t ON i.trip_id = t.id
      WHERE i.invite_code = ? COLLATE NOCASE
    `).get(cleanCode)) as any;

    if (invite) {
      if (invite.status === 'accepted') {
        res.status(400).json({ error: 'CODE_ALREADY_USED', message: 'This trip invitation code has already been used.' });
        return;
      }
      if (invite.status !== 'pending') {
        res.status(400).json({ error: 'CODE_INACTIVE', message: `This trip invitation code is ${invite.status}.` });
        return;
      }
      if (invite.expires_at) {
        const expTime = invite.expires_at.includes('T')
          ? new Date(invite.expires_at).getTime()
          : new Date(`${invite.expires_at}T23:59:59.999Z`).getTime();
        if (expTime < Date.now()) {
          res.status(400).json({ error: 'CODE_EXPIRED', message: 'This trip invitation code has expired.' });
          return;
        }
      }

      const hashedPassword = hashPassword(password);

      try {
        const result = await withTransaction(req.db, async () => {
          const userRes = await req.db.prepare(`
            INSERT INTO users (email, password_hash, role)
            VALUES (?, ?, 'member')
          `).run(email, hashedPassword);
          const userId = Number(userRes.lastInsertRowid);

          const personRes = await req.db.prepare(`
            INSERT INTO persons (display_name, user_id)
            VALUES (?, ?)
          `).run(displayName, userId);
          const personId = Number(personRes.lastInsertRowid);

          if (invite.family_id) {
            await req.db.prepare(`
              INSERT INTO family_memberships (family_id, person_id)
              VALUES (?, ?)
            `).run(invite.family_id, personId);
          } else {
            const famName = `${displayName}'s Family`;
            const famRes = await req.db.prepare(`
              INSERT INTO families (name, admin_user_id)
              VALUES (?, ?)
            `).run(famName, userId);
            const familyId = Number(famRes.lastInsertRowid);
            await req.db.prepare(`
              INSERT INTO family_memberships (family_id, person_id)
              VALUES (?, ?)
            `).run(familyId, personId);
          }

          if (invite.trip_id) {
            await req.db.prepare(`
              INSERT OR IGNORE INTO trip_participants (trip_id, person_id, attendance)
              VALUES (?, ?, 'coming')
            `).run(invite.trip_id, personId);
          }

          await req.db.prepare(`
            UPDATE invitations
            SET status = 'accepted', person_id = COALESCE(person_id, ?)
            WHERE id = ?
          `).run(personId, invite.id);

          const session = await createSession(req.db, userId);

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
            family = await req.db.prepare('SELECT * FROM families WHERE id = ?').get(invite.family_id);
          } else {
            family = await req.db.prepare('SELECT * FROM families WHERE admin_user_id = ?').get(userId);
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
        return;
      } catch (err: any) {
        res.status(500).json({ error: 'REGISTRATION_FAILED', message: err.message });
        return;
      }
    }

    // Code was provided, but not found in either family_invite_codes or invitations
    res.status(404).json({ error: 'INVALID_INVITE', message: 'Invitation code not found. Please verify the code and try again.' });
    return;
  }

  // 3. Direct registration (no invite code provided)
  const hashedPassword = hashPassword(password);

  try {
    const result = await withTransaction(req.db, async () => {
      const userRes = await req.db.prepare(`
        INSERT INTO users (email, password_hash, role)
        VALUES (?, ?, 'member')
      `).run(email, hashedPassword);
      const userId = Number(userRes.lastInsertRowid);

      const personRes = await req.db.prepare(`
        INSERT INTO persons (display_name, user_id)
        VALUES (?, ?)
      `).run(displayName, userId);
      const personId = Number(personRes.lastInsertRowid);

      // Create a default personal family for this newly registered user
      const famName = `${displayName}'s Family`;
      const famRes = await req.db.prepare(`
        INSERT INTO families (name, admin_user_id)
        VALUES (?, ?)
      `).run(famName, userId);
      const familyId = Number(famRes.lastInsertRowid);

      await req.db.prepare(`
        INSERT INTO family_memberships (family_id, person_id)
        VALUES (?, ?)
      `).run(familyId, personId);

      const family = await req.db.prepare('SELECT * FROM families WHERE id = ?').get(familyId);
      const session = await createSession(req.db, userId);

      res.cookie('session_token', session.token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 30 * 24 * 60 * 60 * 1000,
      });

      return {
        user: { id: userId, email, role: 'member', is_active: 1 },
        person: { id: personId, display_name: displayName, user_id: userId, is_active: 1 },
        family,
        token: session.token,
      };
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
};

authRouter.post('/register', handleRegister);
authRouter.post('/signup', handleRegister);
authRouter.post('/register-invite', handleRegister);

authRouter.post('/reset-password', async (req: Request, res: Response) => {
  const { email, password } = req.body || {};
  if (!email || !password || typeof password !== 'string' || password.length < 6) {
    res.status(400).json({ error: 'INVALID_REQUEST', message: 'Valid email and password (minimum 6 characters) are required.' });
    return;
  }
  const user = (await req.db.prepare('SELECT id, email, role, is_active FROM users WHERE email = ? COLLATE NOCASE').get(email.trim())) as any;
  if (!user) {
    res.status(404).json({ error: 'USER_NOT_FOUND', message: 'No account found with this email address.' });
    return;
  }
  const hashedPassword = hashPassword(password);
  await req.db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hashedPassword, user.id);
  const session = await createSession(req.db, user.id);
  res.cookie('session_token', session.token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 30 * 24 * 60 * 60 * 1000,
  });
  const person = await req.db.prepare('SELECT id, display_name, user_id, is_active FROM persons WHERE user_id = ?').get(user.id);
  res.json({ message: 'Password updated successfully', token: session.token, user, person });
});

authRouter.post('/logout', async (req: Request, res: Response) => {
  if (req.sessionToken) {
    await revokeSession(req.db, req.sessionToken);
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
authRouter.get('/profile', requireAuth, async (req: Request, res: Response) => {
  const user = req.user!;
  const person = req.person!;
  const family = req.family;

  let familyMembers: any[] = [];
  if (family) {
    familyMembers = await req.db.prepare(`
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

// PUT /api/auth/profile/name & POST /api/auth/profile/name - Update logged-in user's display name
const updateProfileNameHandler = async (req: Request, res: Response) => {
  const { display_name } = req.body;
  if (!display_name || typeof display_name !== 'string' || display_name.trim().length < 1) {
    res.status(400).json({ error: 'INVALID_NAME', message: 'Display name must be at least 1 character long' });
    return;
  }

  const trimmedName = display_name.trim();
  const userId = req.user!.id;

  try {
    const updatedPerson = await withTransaction(req.db, async () => {
      let person = req.person;
      let oldName = '';
      if (person) {
        oldName = person.display_name;
        await req.db.prepare('UPDATE persons SET display_name = ? WHERE id = ?').run(trimmedName, person.id);
        person.display_name = trimmedName;
      } else {
        const pRes = await req.db.prepare(`
          INSERT INTO persons (display_name, user_id, is_active)
          VALUES (?, ?, 1)
        `).run(trimmedName, userId);
        person = {
          id: Number(pRes.lastInsertRowid),
          display_name: trimmedName,
          user_id: userId,
          is_active: 1,
        };
      }

      await recordAuditLog(req.db, userId, 'UPDATE_USER_NAME', 'persons', person.id, { display_name: oldName }, { display_name: trimmedName });
      return person;
    });

    res.json({ message: 'Name updated successfully', person: updatedPerson });
  } catch (err: any) {
    res.status(500).json({ error: 'NAME_UPDATE_FAILED', message: err.message });
  }
};

authRouter.put('/profile/name', requireAuth, updateProfileNameHandler);
authRouter.post('/profile/name', requireAuth, updateProfileNameHandler);
authRouter.put('/profile', requireAuth, updateProfileNameHandler);

// PUT & POST /api/auth/profile/family/members/:personId/name - Update family member's display name
const updateFamilyMemberNameHandler = async (req: Request, res: Response) => {
  const targetPersonId = Number(req.params.personId);
  const { display_name } = req.body;

  if (!display_name || typeof display_name !== 'string' || display_name.trim().length < 1) {
    res.status(400).json({ error: 'INVALID_NAME', message: 'Display name must be at least 1 character long' });
    return;
  }

  const trimmedName = display_name.trim();
  const family = req.family;

  if (!family && req.user!.role !== 'super_admin') {
    res.status(400).json({ error: 'NO_FAMILY', message: 'You do not belong to a family' });
    return;
  }

  if (req.user!.role !== 'super_admin') {
    const membership = await req.db.prepare(`
      SELECT id FROM family_memberships
      WHERE family_id = ? AND person_id = ? AND left_at IS NULL
    `).get(family!.id, targetPersonId);

    if (!membership) {
      res.status(404).json({ error: 'NOT_FOUND', message: 'Member not found in your family' });
      return;
    }
  }

  const existingPerson = (await req.db.prepare('SELECT id, display_name FROM persons WHERE id = ?').get(targetPersonId)) as any;
  if (!existingPerson) {
    res.status(404).json({ error: 'NOT_FOUND', message: 'Person not found' });
    return;
  }

  try {
    await req.db.prepare('UPDATE persons SET display_name = ? WHERE id = ?').run(trimmedName, targetPersonId);
    await recordAuditLog(req.db, req.user!.id, 'UPDATE_FAMILY_MEMBER_NAME', 'persons', targetPersonId, { display_name: existingPerson.display_name }, { display_name: trimmedName });
    res.json({ message: 'Member name updated successfully', personId: targetPersonId, display_name: trimmedName });
  } catch (err: any) {
    res.status(500).json({ error: 'MEMBER_UPDATE_FAILED', message: err.message });
  }
};

authRouter.put('/profile/family/members/:personId/name', requireAuth, updateFamilyMemberNameHandler);
authRouter.post('/profile/family/members/:personId/name', requireAuth, updateFamilyMemberNameHandler);

// POST /api/auth/profile/family - Create or update family name
authRouter.post('/profile/family', requireAuth, async (req: Request, res: Response) => {
  const { name } = req.body;
  if (!name || typeof name !== 'string' || name.trim().length < 2) {
    res.status(400).json({ error: 'INVALID_NAME', message: 'Family name must be at least 2 characters long' });
    return;
  }

  const trimmedName = name.trim();
  const user = req.user!;
  const person = req.person!;

  try {
    const updatedFamily = await withTransaction(req.db, async () => {
      let family = req.family;
      if (family) {
        // Update existing family name
        await req.db.prepare(`UPDATE families SET name = ? WHERE id = ?`).run(trimmedName, family.id);
        return { ...family, name: trimmedName };
      } else {
        // Create new family for this user
        const famRes = await req.db.prepare(`
          INSERT INTO families (name, admin_user_id, is_active)
          VALUES (?, ?, 1)
        `).run(trimmedName, user.id);
        const familyId = Number(famRes.lastInsertRowid);

        if (person) {
          await req.db.prepare(`
            INSERT OR IGNORE INTO family_memberships (family_id, person_id)
            VALUES (?, ?)
          `).run(familyId, person.id);
        }

        // Elevate user role to family_admin if currently standard member
        if (user.role === 'member') {
          await req.db.prepare(`UPDATE users SET role = 'family_admin' WHERE id = ?`).run(user.id);
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
authRouter.post('/profile/family/members', requireAuth, async (req: Request, res: Response) => {
  const { display_name, email, password } = req.body;
  if (!display_name || typeof display_name !== 'string' || display_name.trim().length < 2) {
    res.status(400).json({ error: 'INVALID_NAME', message: 'Display name must be at least 2 characters' });
    return;
  }

  const user = req.user!;
  const person = req.person!;
  let family = req.family;

  try {
    const createdMember = await withTransaction(req.db, async () => {
      // If user doesn't have a family yet, auto-create one based on their name
      if (!family) {
        const defaultFamName = `${person?.display_name || user.email.split('@')[0]}'s Family`;
        const famRes = await req.db.prepare(`
          INSERT INTO families (name, admin_user_id, is_active)
          VALUES (?, ?, 1)
        `).run(defaultFamName, user.id);
        const famId = Number(famRes.lastInsertRowid);

        if (person) {
          await req.db.prepare(`
            INSERT OR IGNORE INTO family_memberships (family_id, person_id)
            VALUES (?, ?)
          `).run(famId, person.id);
        }

        family = { id: famId, name: defaultFamName, admin_user_id: user.id, is_active: 1 } as any;
      }

      let newUserId: number | null = null;
      if (email && password) {
        const existing = await req.db.prepare('SELECT id FROM users WHERE email = ? COLLATE NOCASE').get(email);
        if (existing) {
          throw new Error(`Email ${email} is already in use`);
        }
        const pwdHash = hashPassword(password);
        const uRes = await req.db.prepare(`
          INSERT INTO users (email, password_hash, role, is_active)
          VALUES (?, ?, 'member', 1)
        `).run(email, pwdHash);
        newUserId = Number(uRes.lastInsertRowid);
      }

      const pRes = await req.db.prepare(`
        INSERT INTO persons (display_name, user_id, is_active)
        VALUES (?, ?, 1)
      `).run(display_name.trim(), newUserId);
      const newPersonId = Number(pRes.lastInsertRowid);

      await req.db.prepare(`
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
authRouter.delete('/profile/family/members/:personId', requireAuth, async (req: Request, res: Response) => {
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
  const membership = await req.db.prepare(`
    SELECT id FROM family_memberships
    WHERE family_id = ? AND person_id = ? AND left_at IS NULL
  `).get(family.id, targetPersonId);

  if (!membership) {
    res.status(404).json({ error: 'NOT_FOUND', message: 'Member not found in your family' });
    return;
  }

  // Check if they are involved in trip expenses
  const hasExpenses = await req.db.prepare(`
    SELECT 1 FROM expense_allocations WHERE account_type = 'person' AND account_id = ?
    UNION
    SELECT 1 FROM expenses WHERE paid_by_type = 'person' AND paid_by_id = ?
    LIMIT 1
  `).get(targetPersonId, targetPersonId);

  if (hasExpenses) {
    // Soft remove: set left_at
    await req.db.prepare(`
      UPDATE family_memberships
      SET left_at = datetime('now')
      WHERE family_id = ? AND person_id = ?
    `).run(family.id, targetPersonId);
  } else {
    // Delete membership
    await req.db.prepare(`
      DELETE FROM family_memberships
      WHERE family_id = ? AND person_id = ?
    `).run(family.id, targetPersonId);
  }

  res.json({ message: 'Member removed from family' });
});
