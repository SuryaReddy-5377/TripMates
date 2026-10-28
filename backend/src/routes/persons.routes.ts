import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { requireAuth } from '../auth/middleware';

export const personsRouter = Router();

const createPersonSchema = z.object({
  display_name: z.string().min(2),
  family_id: z.number().int().positive().optional(),
});

// GET /api/persons/available - Fetch all active members who can be invited to trips
personsRouter.get('/available', requireAuth, (req: Request, res: Response) => {
  const persons = req.db.prepare(`
    SELECT p.id, p.display_name, p.user_id, p.is_active,
           f.id as family_id, f.name as family_name,
           u.email, u.role
    FROM persons p
    LEFT JOIN family_memberships fm ON fm.person_id = p.id AND fm.left_at IS NULL
    LEFT JOIN families f ON fm.family_id = f.id
    LEFT JOIN users u ON p.user_id = u.id
    WHERE p.is_active = 1
    ORDER BY p.display_name ASC
  `).all();
  res.json(persons);
});

personsRouter.get('/', requireAuth, (req: Request, res: Response) => {
  if (req.user!.role === 'super_admin') {
    const persons = req.db.prepare(`
      SELECT p.id, p.display_name, p.user_id, p.is_active,
             f.id as family_id, f.name as family_name,
             u.email, u.role
      FROM persons p
      LEFT JOIN family_memberships fm ON fm.person_id = p.id AND fm.left_at IS NULL
      LEFT JOIN families f ON fm.family_id = f.id
      LEFT JOIN users u ON p.user_id = u.id
      WHERE p.is_active = 1
      ORDER BY p.display_name ASC
    `).all();
    res.json(persons);
    return;
  }

  // Regular members / family admin: members of own family + members in trips they share
  const familyId = req.family?.id ?? null;
  const personId = req.person?.id ?? null;

  const persons = req.db.prepare(`
    SELECT DISTINCT p.id, p.display_name, p.user_id, p.is_active,
           f.id as family_id, f.name as family_name,
           u.email, u.role
    FROM persons p
    LEFT JOIN family_memberships fm ON fm.person_id = p.id AND fm.left_at IS NULL
    LEFT JOIN families f ON fm.family_id = f.id
    LEFT JOIN users u ON p.user_id = u.id
    WHERE p.is_active = 1 AND (
      (fm.family_id IS NOT NULL AND fm.family_id = ?)
      OR p.id = ?
      OR p.id IN (
        SELECT tp.person_id FROM trip_participants tp
        WHERE tp.trip_id IN (
          SELECT trip_id FROM trip_participants WHERE person_id = ?
          UNION
          SELECT trip_id FROM trip_families WHERE family_id = ?
        )
      )
    )
    ORDER BY p.display_name ASC
  `).all(familyId, personId, personId, familyId);

  res.json(persons);
});

personsRouter.post('/', requireAuth, (req: Request, res: Response) => {
  const parseResult = createPersonSchema.safeParse(req.body);
  if (!parseResult.success) {
    res.status(400).json({ error: 'VALIDATION_ERROR', details: parseResult.error.format() });
    return;
  }

  const { display_name, family_id } = parseResult.data;

  // If family_id is specified, verify permission to add to that family
  if (family_id && req.user!.role !== 'super_admin') {
    if (!req.family || req.family.id !== family_id) {
      res.status(403).json({ error: 'FORBIDDEN', message: 'You can only add persons to your own family' });
      return;
    }
  }

  const pRes = req.db.prepare(`
    INSERT INTO persons (display_name, is_active)
    VALUES (?, 1)
  `).run(display_name);

  const personId = Number(pRes.lastInsertRowid);

  if (family_id) {
    req.db.prepare(`
      INSERT INTO family_memberships (family_id, person_id)
      VALUES (?, ?)
    `).run(family_id, personId);
  }

  res.status(201).json({ id: personId, display_name, family_id: family_id || null });
});
