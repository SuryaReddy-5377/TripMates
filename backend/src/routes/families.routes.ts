import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { requireAuth, requireRole, requireFamilyAccess } from '../auth/middleware';
import { withTransaction } from '../db/connection';
import { recordAuditLog } from '../auth/audit';
import { hashPassword } from '../auth/password';

export const familiesRouter = Router();

const createFamilySchema = z.object({
  name: z.string().min(2),
  admin_email: z.string().email().optional(),
  admin_password: z.string().min(6).optional(),
  admin_display_name: z.string().min(2).optional(),
});

const addMemberSchema = z.object({
  display_name: z.string().min(2),
  email: z.string().email().optional(),
  password: z.string().min(6).optional(),
});

// GET /api/families - Respects family isolation
familiesRouter.get('/', requireAuth, (req: Request, res: Response) => {
  if (req.user!.role === 'super_admin') {
    const families = req.db.prepare(`
      SELECT f.id, f.name, f.admin_user_id, f.is_active, f.created_at,
             u.email as admin_email,
             (SELECT count(*) FROM family_memberships fm WHERE fm.family_id = f.id AND fm.left_at IS NULL) as member_count
      FROM families f
      LEFT JOIN users u ON f.admin_user_id = u.id
      ORDER BY f.name ASC
    `).all();
    res.json(families);
    return;
  }

  // Non-super-admins: only their own family
  if (req.family) {
    const fam = req.db.prepare(`
      SELECT f.id, f.name, f.admin_user_id, f.is_active, f.created_at,
             u.email as admin_email,
             (SELECT count(*) FROM family_memberships fm WHERE fm.family_id = f.id AND fm.left_at IS NULL) as member_count
      FROM families f
      LEFT JOIN users u ON f.admin_user_id = u.id
      WHERE f.id = ?
    `).get(req.family.id);
    res.json(fam ? [fam] : []);
    return;
  }

  res.json([]);
});

// POST /api/families - Super Admin only
familiesRouter.post('/', requireAuth, requireRole('super_admin'), (req: Request, res: Response) => {
  const parseResult = createFamilySchema.safeParse(req.body);
  if (!parseResult.success) {
    res.status(400).json({ error: 'VALIDATION_ERROR', details: parseResult.error.format() });
    return;
  }

  const { name, admin_email, admin_password, admin_display_name } = parseResult.data;

  try {
    const result = withTransaction(req.db, () => {
      let adminUserId: number | null = null;
      let adminPersonId: number | null = null;

      if (admin_email && admin_password) {
        const existing = req.db.prepare('SELECT id FROM users WHERE email = ? COLLATE NOCASE').get(admin_email);
        if (existing) {
          throw new Error(`Email ${admin_email} is already in use`);
        }

        const pwdHash = hashPassword(admin_password);
        const userRes = req.db.prepare(`
          INSERT INTO users (email, password_hash, role, is_active)
          VALUES (?, ?, 'family_admin', 1)
        `).run(admin_email, pwdHash);

        adminUserId = Number(userRes.lastInsertRowid);

        const personRes = req.db.prepare(`
          INSERT INTO persons (display_name, user_id, is_active)
          VALUES (?, ?, 1)
        `).run(admin_display_name || name + ' Admin', adminUserId);

        adminPersonId = Number(personRes.lastInsertRowid);
      }

      const famRes = req.db.prepare(`
        INSERT INTO families (name, admin_user_id, is_active)
        VALUES (?, ?, 1)
      `).run(name, adminUserId);

      const familyId = Number(famRes.lastInsertRowid);

      if (adminPersonId) {
        req.db.prepare(`
          INSERT INTO family_memberships (family_id, person_id)
          VALUES (?, ?)
        `).run(familyId, adminPersonId);
      }

      recordAuditLog(req.db, req.user!.id, 'CREATE_FAMILY', 'families', familyId, null, { name, adminUserId });

      return { familyId, name, adminUserId };
    });

    res.status(201).json(result);
  } catch (err) {
    res.status(400).json({ error: 'FAILED_TO_CREATE_FAMILY', message: (err as Error).message });
  }
});

// GET /api/families/:familyId - with family data isolation check
familiesRouter.get('/:familyId', requireAuth, requireFamilyAccess('familyId'), (req: Request, res: Response) => {
  const familyId = Number(req.params.familyId);
  const family = req.db.prepare(`
    SELECT f.id, f.name, f.admin_user_id, f.is_active, f.created_at, u.email as admin_email
    FROM families f
    LEFT JOIN users u ON f.admin_user_id = u.id
    WHERE f.id = ?
  `).get(familyId);

  if (!family) {
    res.status(404).json({ error: 'NOT_FOUND', message: 'Family not found' });
    return;
  }

  const members = req.db.prepare(`
    SELECT p.id as person_id, p.display_name, p.user_id, u.email, u.role, fm.joined_at
    FROM family_memberships fm
    JOIN persons p ON fm.person_id = p.id
    LEFT JOIN users u ON p.user_id = u.id
    WHERE fm.family_id = ? AND fm.left_at IS NULL AND p.is_active = 1
    ORDER BY p.display_name ASC
  `).all(familyId);

  res.json({ ...(family as object), members });
});

// POST /api/families/:familyId/members - Super Admin or that family's admin
familiesRouter.post('/:familyId/members', requireAuth, requireFamilyAccess('familyId'), (req: Request, res: Response) => {
  const familyId = Number(req.params.familyId);
  const parseResult = addMemberSchema.safeParse(req.body);
  if (!parseResult.success) {
    res.status(400).json({ error: 'VALIDATION_ERROR', details: parseResult.error.format() });
    return;
  }

  const { display_name, email, password } = parseResult.data;

  try {
    const member = withTransaction(req.db, () => {
      let userId: number | null = null;
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
        userId = Number(uRes.lastInsertRowid);
      }

      const pRes = req.db.prepare(`
        INSERT INTO persons (display_name, user_id, is_active)
        VALUES (?, ?, 1)
      `).run(display_name, userId);

      const personId = Number(pRes.lastInsertRowid);

      req.db.prepare(`
        INSERT INTO family_memberships (family_id, person_id)
        VALUES (?, ?)
      `).run(familyId, personId);

      recordAuditLog(req.db, req.user!.id, 'ADD_FAMILY_MEMBER', 'family_memberships', familyId, null, { personId, display_name, email });

      return { personId, display_name, userId, email, familyId };
    });

    res.status(201).json(member);
  } catch (err) {
    res.status(400).json({ error: 'FAILED_TO_ADD_MEMBER', message: (err as Error).message });
  }
});
