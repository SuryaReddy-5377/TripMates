import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { requireAuth, requireTripAccess } from '../auth/middleware';
import { withTransaction } from '../db/connection';

export const attendanceRouter = Router({ mergeParams: true });

const updateAttendanceSchema = z.object({
  attendance: z.enum(['pending', 'coming', 'not_coming']),
});

// GET /api/trips/:tripId/attendance - List attendance status
attendanceRouter.get('/', requireAuth, requireTripAccess('tripId'), (req: Request, res: Response) => {
  const tripId = req.trip!.id;

  const participants = req.db.prepare(`
    SELECT tp.person_id, p.display_name, tp.attendance, tp.responded_at,
           f.id as family_id, f.name as family_name,
           u.id as user_id
    FROM trip_participants tp
    JOIN persons p ON tp.person_id = p.id
    LEFT JOIN family_memberships fm ON fm.person_id = p.id AND fm.left_at IS NULL
    LEFT JOIN families f ON fm.family_id = f.id
    LEFT JOIN users u ON p.user_id = u.id
    WHERE tp.trip_id = ?
    ORDER BY p.display_name ASC
  `).all(tripId);

  res.json(participants);
});

// PUT /api/trips/:tripId/attendance/:personId - Respond to attendance
attendanceRouter.put('/:personId', requireAuth, requireTripAccess('tripId'), (req: Request, res: Response) => {
  const tripId = req.trip!.id;
  const personId = Number(req.params.personId);

  const parseResult = updateAttendanceSchema.safeParse(req.body);
  if (!parseResult.success) {
    res.status(400).json({ error: 'VALIDATION_ERROR', details: parseResult.error.format() });
    return;
  }

  const newStatus = parseResult.data.attendance;

  // Authorization check: who can change this person's attendance?
  const isSuperAdmin = req.user!.role === 'super_admin';
  const isTripCreator = req.trip!.created_by === req.user!.id;
  const isSelf = req.person?.id === personId;

  // Check if user is family admin of this person's family
  let isFamilyAdminOfPerson = false;
  const personFamily = req.db.prepare(`
    SELECT f.admin_user_id
    FROM family_memberships fm
    JOIN families f ON fm.family_id = f.id
    WHERE fm.person_id = ? AND fm.left_at IS NULL
  `).get(personId) as { admin_user_id: number | null } | undefined;

  if (personFamily && personFamily.admin_user_id === req.user!.id) {
    isFamilyAdminOfPerson = true;
  }

  if (!isSuperAdmin && !isTripCreator && !isSelf && !isFamilyAdminOfPerson) {
    res.status(403).json({ error: 'FORBIDDEN', message: 'You can only update attendance for yourself or your family members' });
    return;
  }

  // Get current attendance
  const current = req.db.prepare(`
    SELECT attendance FROM trip_participants
    WHERE trip_id = ? AND person_id = ?
  `).get(tripId, personId) as { attendance: string } | undefined;

  if (!current) {
    res.status(404).json({ error: 'NOT_FOUND', message: 'Participant not in this trip' });
    return;
  }

  const oldStatus = current.attendance;
  const now = new Date().toISOString();

  withTransaction(req.db, () => {
    req.db.prepare(`
      UPDATE trip_participants
      SET attendance = ?, responded_at = ?
      WHERE trip_id = ? AND person_id = ?
    `).run(newStatus, now, tripId, personId);

    req.db.prepare(`
      INSERT INTO attendance_log (trip_id, person_id, old_value, new_value, changed_by, changed_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(tripId, personId, oldStatus, newStatus, req.user!.id, now);
  });

  res.json({ message: 'Attendance updated successfully', person_id: personId, attendance: newStatus, responded_at: now });
});

// GET /api/trips/:tripId/attendance/log - History of attendance changes
attendanceRouter.get('/log', requireAuth, requireTripAccess('tripId'), (req: Request, res: Response) => {
  const tripId = req.trip!.id;

  const logRows = req.db.prepare(`
    SELECT al.id, al.trip_id, al.person_id, al.old_value, al.new_value, al.changed_by, al.changed_at,
           p.display_name as person_name,
           u.email as changed_by_email
    FROM attendance_log al
    JOIN persons p ON al.person_id = p.id
    JOIN users u ON al.changed_by = u.id
    WHERE al.trip_id = ?
    ORDER BY al.changed_at DESC
  `).all(tripId);

  res.json(logRows);
});
