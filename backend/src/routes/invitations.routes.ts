import { Router, Request, Response } from 'express';
import { z } from 'zod';
import crypto from 'node:crypto';
import { requireAuth, requireTripAccess } from '../auth/middleware';
import { withTransaction } from '../db/connection';
import { recordAuditLog } from '../auth/audit';
import { notifyTripParticipantAdded } from '../notifications/service';

export const invitationsRouter = Router({ mergeParams: true });
export const globalInvitationsRouter = Router();

const createInvitationSchema = z.object({
  family_id: z.number().int().positive().optional().nullable(),
  person_id: z.number().int().positive().optional().nullable(),
  email: z.string().email().optional().nullable(),
});

const acceptInvitationSchema = z.object({
  invite_code: z.string().min(4),
});

// GET /api/trips/:tripId/invitations - List invitations
invitationsRouter.get('/', requireAuth, requireTripAccess('tripId'), (req: Request, res: Response) => {
  const tripId = req.trip!.id;

  const invitations = req.db.prepare(`
    SELECT i.id, i.trip_id, i.family_id, i.person_id, i.email, i.invite_code,
           i.status, i.created_by, i.created_at,
           f.name as family_name,
           p.display_name as person_name,
           u.email as creator_email
    FROM invitations i
    LEFT JOIN families f ON i.family_id = f.id
    LEFT JOIN persons p ON i.person_id = p.id
    JOIN users u ON i.created_by = u.id
    WHERE i.trip_id = ?
    ORDER BY i.created_at DESC
  `).all(tripId);

  res.json(invitations);
});

// POST /api/trips/:tripId/invitations - Generate an invite code
invitationsRouter.post('/', requireAuth, requireTripAccess('tripId'), (req: Request, res: Response) => {
  const tripId = req.trip!.id;
  const parseResult = createInvitationSchema.safeParse(req.body);
  if (!parseResult.success) {
    res.status(400).json({ error: 'VALIDATION_ERROR', details: parseResult.error.format() });
    return;
  }

  const { family_id, person_id, email } = parseResult.data;
  const inviteCode = 'TRIP-' + crypto.randomBytes(4).toString('hex').toUpperCase();

  try {
    const resId = req.db.prepare(`
      INSERT INTO invitations (trip_id, family_id, person_id, email, invite_code, status, created_by)
      VALUES (?, ?, ?, ?, ?, 'pending', ?)
    `).run(tripId, family_id || null, person_id || null, email || null, inviteCode, req.user!.id);

    recordAuditLog(req.db, req.user!.id, 'CREATE_INVITATION', 'invitations', Number(resId.lastInsertRowid), null, { tripId, inviteCode });

    res.status(201).json({
      id: Number(resId.lastInsertRowid),
      trip_id: tripId,
      invite_code: inviteCode,
      status: 'pending',
    });
  } catch (err) {
    res.status(400).json({ error: 'FAILED_TO_CREATE_INVITATION', message: (err as Error).message });
  }
});

// POST /api/invitations/accept - Accept an invitation (supports both trip invites & family invite codes)
globalInvitationsRouter.post('/accept', requireAuth, (req: Request, res: Response) => {
  const parseResult = acceptInvitationSchema.safeParse(req.body);
  if (!parseResult.success) {
    res.status(400).json({ error: 'VALIDATION_ERROR', details: parseResult.error.format() });
    return;
  }

  const cleanCode = parseResult.data.invite_code.trim().toUpperCase();

  if (!req.person) {
    res.status(400).json({ error: 'NO_PERSON', message: 'You must have a member profile to join trips or families' });
    return;
  }

  // 1. Check family_invite_codes first
  const famCode = req.db.prepare(`
    SELECT * FROM family_invite_codes
    WHERE code = ? COLLATE NOCASE
  `).get(cleanCode) as any;

  if (famCode) {
    if (famCode.status === 'revoked') {
      res.status(400).json({ error: 'CODE_REVOKED', message: 'This family invitation code has been revoked by an administrator.' });
      return;
    }
    if (famCode.status === 'exhausted' || famCode.uses_count >= famCode.max_uses) {
      res.status(400).json({ error: 'CODE_EXHAUSTED', message: 'This family invitation code has reached its maximum usage limit.' });
      return;
    }
    if (famCode.status !== 'active') {
      res.status(400).json({ error: 'CODE_INACTIVE', message: 'This family invitation code is currently inactive.' });
      return;
    }
    if (famCode.expires_at) {
      const expTime = famCode.expires_at.includes('T')
        ? new Date(famCode.expires_at).getTime()
        : new Date(`${famCode.expires_at}T23:59:59.999Z`).getTime();
      if (expTime < Date.now()) {
        res.status(400).json({ error: 'CODE_EXPIRED', message: 'This family invitation code has expired.' });
        return;
      }
    }

    if (!famCode.family_id) {
      res.status(400).json({ error: 'NO_FAMILY', message: 'This invitation code is not linked to an active family group.' });
      return;
    }

    withTransaction(req.db, () => {
      // Atomic usage check and increment
      const updated = req.db.prepare(`
        UPDATE family_invite_codes
        SET uses_count = uses_count + 1,
            status = CASE WHEN uses_count + 1 >= max_uses THEN 'exhausted' ELSE status END
        WHERE id = ? AND status = 'active' AND uses_count < max_uses
      `).run(famCode.id);

      if (updated.changes === 0) {
        throw new Error('This invitation code usage limit was reached.');
      }

      req.db.prepare(`
        INSERT OR IGNORE INTO family_memberships (family_id, person_id)
        VALUES (?, ?)
      `).run(famCode.family_id, req.person!.id);

      recordAuditLog(req.db, req.user!.id, 'ACCEPT_FAMILY_INVITATION', 'family_invite_codes', famCode.id, null, {
        family_id: famCode.family_id,
      });
    });

    const fam = req.db.prepare('SELECT name FROM families WHERE id = ?').get(famCode.family_id) as any;
    res.json({ message: `Successfully joined family: ${fam?.name || 'Family'}`, family_id: famCode.family_id });
    return;
  }

  // 2. Check trip-based invitations
  const invite = req.db.prepare(`
    SELECT i.*, t.name as trip_name
    FROM invitations i
    JOIN trips t ON i.trip_id = t.id
    WHERE i.invite_code = ? COLLATE NOCASE
  `).get(cleanCode) as any;

  if (invite) {
    if (invite.status === 'accepted') {
      res.status(400).json({ error: 'CODE_ALREADY_USED', message: 'This trip invitation code has already been accepted.' });
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

    withTransaction(req.db, () => {
      // Add user's person as participant
      req.db.prepare(`
        INSERT OR IGNORE INTO trip_participants (trip_id, person_id, attendance)
        VALUES (?, ?, 'coming')
      `).run(invite.trip_id, req.person!.id);

      // If invite had a family, add family
      if (invite.family_id) {
        req.db.prepare(`
          INSERT OR IGNORE INTO trip_families (trip_id, family_id)
          VALUES (?, ?)
        `).run(invite.trip_id, invite.family_id);
      }

      req.db.prepare(`
        UPDATE invitations SET status = 'accepted', person_id = COALESCE(person_id, ?) WHERE id = ?
      `).run(req.person!.id, invite.id);

      notifyTripParticipantAdded(req.db, {
        tripId: invite.trip_id,
        personId: req.person!.id,
        addedByUserId: invite.created_by,
        tripName: invite.trip_name,
      });

      recordAuditLog(req.db, req.user!.id, 'ACCEPT_INVITATION', 'invitations', invite.id, { status: 'pending' }, { status: 'accepted' });
    });

    res.json({ message: `Successfully joined trip: ${invite.trip_name}`, trip_id: invite.trip_id });
    return;
  }

  res.status(404).json({ error: 'INVALID_INVITATION', message: 'Invitation code not found or already accepted' });
});
