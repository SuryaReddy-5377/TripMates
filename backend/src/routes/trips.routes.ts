import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { requireAuth, requireTripAccess } from '../auth/middleware';
import { withTransaction } from '../db/connection';
import { recordAuditLog } from '../auth/audit';
import { parseRupees } from '../finance/money';
import { notifyTripParticipantAdded, notifyTripFamilyAdded } from '../notifications/service';

export const tripsRouter = Router();

const createTripSchema = z.object({
  name: z.string().min(2),
  destination: z.string().optional(),
  start_date: z.string().optional(),
  end_date: z.string().optional(),
  description: z.string().optional(),
  notes: z.string().optional(),
  cover_image: z.string().trim().max(1000).optional().nullable(),
  budget: z.union([z.string(), z.number()]).optional(),
  budget_paise: z.number().int().nonnegative().optional(),
  is_private: z.union([z.boolean(), z.number()]).optional().default(false),
  family_ids: z.array(z.number().int().positive()).optional().default([]),
  participant_person_ids: z.array(z.number().int().positive()).optional().default([]),
});

const updateTripSchema = z.object({
  name: z.string().min(2).optional(),
  destination: z.string().optional(),
  start_date: z.string().optional().nullable(),
  end_date: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  cover_image: z.string().trim().max(1000).optional().nullable(),
  budget: z.union([z.string(), z.number()]).optional().nullable(),
  budget_paise: z.number().int().nonnegative().optional().nullable(),
  status: z.enum(['planning', 'upcoming', 'ongoing', 'completed']).optional(),
  is_private: z.union([z.boolean(), z.number()]).optional(),
  participant_person_ids: z.array(z.number().int().positive()).optional(),
  family_ids: z.array(z.number().int().positive()).optional(),
});

// GET /api/trips - Scoped list of accessible trips
tripsRouter.get('/', requireAuth, (req: Request, res: Response) => {
  const isSuperAdmin = req.user!.role === 'super_admin';
  const userId = req.user!.id;
  const personId = req.person?.id ?? -1;
  const familyId = req.family?.id ?? -1;

  let query = `
    SELECT DISTINCT t.id, t.name, t.destination, t.start_date, t.end_date,
           t.description, t.notes, t.cover_image, t.budget_paise, t.status, t.is_private,
           t.created_by, t.completed_at, t.created_at,
           u.email as creator_email,
           (SELECT count(*) FROM trip_participants tp WHERE tp.trip_id = t.id) as participant_count,
           (SELECT count(*) FROM expenses e WHERE e.trip_id = t.id AND e.voided_at IS NULL) as expense_count,
           (SELECT coalesce(sum(e.total_paise), 0) FROM expenses e WHERE e.trip_id = t.id AND e.voided_at IS NULL) as total_spent_paise,
           tp_self.attendance as self_attendance
    FROM trips t
    LEFT JOIN users u ON t.created_by = u.id
    LEFT JOIN trip_families tf ON tf.trip_id = t.id AND tf.family_id = ?
    LEFT JOIN trip_participants tp_self ON tp_self.trip_id = t.id AND tp_self.person_id = ?
  `;

  if (!isSuperAdmin) {
    query += `
      WHERE (
        t.created_by = ?
        OR tf.family_id IS NOT NULL
        OR tp_self.person_id IS NOT NULL
      )
    `;
  }

  query += ` ORDER BY t.created_at DESC`;

  const rows = isSuperAdmin
    ? req.db.prepare(query).all(familyId, personId)
    : req.db.prepare(query).all(familyId, personId, userId);

  // Filter out private completed trips for users who did not attend
  const visibleTrips = rows.filter((t: any) => {
    if (isSuperAdmin || t.created_by === userId) return true;
    if (t.is_private === 1 && t.status === 'completed') {
      return t.self_attendance === 'coming';
    }
    return true;
  });

  res.json(visibleTrips);
});

// POST /api/trips - Create trip
tripsRouter.post('/', requireAuth, (req: Request, res: Response) => {
  const parseResult = createTripSchema.safeParse(req.body);
  if (!parseResult.success) {
    res.status(400).json({ error: 'VALIDATION_ERROR', details: parseResult.error.format() });
    return;
  }

  const data = parseResult.data;
  let budgetPaise: number | null = null;
  if (data.budget_paise !== undefined) {
    budgetPaise = data.budget_paise;
  } else if (data.budget !== undefined && data.budget !== '') {
    budgetPaise = typeof data.budget === 'number' ? Math.round(data.budget * 100) : parseRupees(String(data.budget));
  }

  const isPrivateNum = Boolean(data.is_private) ? 1 : 0;

  try {
    const createdTrip = withTransaction(req.db, () => {
      const tripRes = req.db.prepare(`
        INSERT INTO trips (name, destination, start_date, end_date, description, notes, cover_image, budget_paise, is_private, created_by)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        data.name,
        data.destination || null,
        data.start_date || null,
        data.end_date || null,
        data.description || null,
        data.notes || null,
        data.cover_image || null,
        budgetPaise,
        isPrivateNum,
        req.user!.id
      );

      const tripId = Number(tripRes.lastInsertRowid);

      // Add families
      const participantSet = new Set<number>(data.participant_person_ids);

      for (const famId of data.family_ids) {
        req.db.prepare(`
          INSERT OR IGNORE INTO trip_families (trip_id, family_id)
          VALUES (?, ?)
        `).run(tripId, famId);

        // Fetch members of this family and add to participant set
        const members = req.db.prepare(`
          SELECT person_id FROM family_memberships
          WHERE family_id = ? AND left_at IS NULL
        `).all(famId) as Array<{ person_id: number }>;

        for (const m of members) {
          participantSet.add(m.person_id);
        }
      }

      // If creator has a linked person, include creator in participants
      if (req.person) {
        participantSet.add(req.person.id);
      }

      // Insert trip_participants and notify
      for (const personId of participantSet) {
        req.db.prepare(`
          INSERT OR IGNORE INTO trip_participants (trip_id, person_id, attendance)
          VALUES (?, ?, 'pending')
        `).run(tripId, personId);

        notifyTripParticipantAdded(req.db, {
          tripId,
          personId,
          addedByUserId: req.user!.id,
          tripName: data.name,
          tripDates: data.start_date ? (data.end_date ? `${data.start_date} to ${data.end_date}` : data.start_date) : data.destination,
        });
      }

      recordAuditLog(req.db, req.user!.id, 'CREATE_TRIP', 'trips', tripId, null, { name: data.name, budgetPaise, isPrivate: isPrivateNum });

      return { id: tripId, name: data.name, destination: data.destination };
    });

    res.status(201).json(createdTrip);
  } catch (err) {
    res.status(400).json({ error: 'FAILED_TO_CREATE_TRIP', message: (err as Error).message });
  }
});

// GET /api/trips/:tripId - With access control & completed private restriction
tripsRouter.get('/:tripId', requireAuth, requireTripAccess('tripId'), (req: Request, res: Response) => {
  const trip = req.trip!;

  // Fetch participating families
  const families = req.db.prepare(`
    SELECT f.id, f.name
    FROM trip_families tf
    JOIN families f ON tf.family_id = f.id
    WHERE tf.trip_id = ?
    ORDER BY f.name ASC
  `).all(trip.id);

  // Fetch participants with their family affiliation and current attendance
  const participants = req.db.prepare(`
    SELECT p.id, p.display_name, tp.attendance, tp.responded_at,
           f.id as family_id, f.name as family_name,
           u.id as user_id, u.email
    FROM trip_participants tp
    JOIN persons p ON tp.person_id = p.id
    LEFT JOIN family_memberships fm ON fm.person_id = p.id AND fm.left_at IS NULL
    LEFT JOIN families f ON fm.family_id = f.id
    LEFT JOIN users u ON p.user_id = u.id
    WHERE tp.trip_id = ?
    ORDER BY p.display_name ASC
  `).all(trip.id);

  res.json({
    ...trip,
    families,
    participants,
  });
});

// PATCH /api/trips/:tripId
tripsRouter.patch('/:tripId', requireAuth, requireTripAccess('tripId'), (req: Request, res: Response) => {
  const parseResult = updateTripSchema.safeParse(req.body);
  if (!parseResult.success) {
    res.status(400).json({ error: 'VALIDATION_ERROR', details: parseResult.error.format() });
    return;
  }

  const trip = req.trip!;
  const data = parseResult.data;

  // Only creator or super admin can edit trip metadata
  if (req.user!.role !== 'super_admin' && trip.created_by !== req.user!.id) {
    res.status(403).json({ error: 'FORBIDDEN', message: 'Only trip creator or super admin can update trip settings' });
    return;
  }

  let budgetPaise = trip.budget_paise;
  if (data.budget_paise !== undefined) {
    budgetPaise = data.budget_paise;
  } else if (data.budget !== undefined) {
    budgetPaise = data.budget === null || data.budget === '' ? null : (typeof data.budget === 'number' ? Math.round(data.budget * 100) : parseRupees(String(data.budget)));
  }

  const updatedName = data.name ?? trip.name;
  const updatedDest = data.destination !== undefined ? data.destination : trip.destination;
  const updatedStart = data.start_date !== undefined ? data.start_date : trip.start_date;
  const updatedEnd = data.end_date !== undefined ? data.end_date : trip.end_date;
  const updatedDesc = data.description !== undefined ? data.description : trip.description;
  const updatedNotes = data.notes !== undefined ? data.notes : trip.notes;
  const updatedCoverImage = (data.cover_image !== undefined ? data.cover_image : trip.cover_image) ?? null;
  const updatedStatus = data.status ?? trip.status;
  const updatedPrivate = data.is_private !== undefined ? (Boolean(data.is_private) ? 1 : 0) : trip.is_private;
  const completedAt = updatedStatus === 'completed' && !trip.completed_at ? new Date().toISOString() : trip.completed_at;

  withTransaction(req.db, () => {
    req.db.prepare(`
      UPDATE trips
      SET name = ?, destination = ?, start_date = ?, end_date = ?, description = ?, notes = ?,
          cover_image = ?, budget_paise = ?, status = ?, is_private = ?, completed_at = ?
      WHERE id = ?
    `).run(
      updatedName,
      updatedDest,
      updatedStart,
      updatedEnd,
      updatedDesc,
      updatedNotes,
      updatedCoverImage,
      budgetPaise,
      updatedStatus,
      updatedPrivate,
      completedAt,
      trip.id
    );

    // If new families provided, insert them and their members
    if (data.family_ids && data.family_ids.length > 0) {
      for (const famId of data.family_ids) {
        req.db.prepare(`
          INSERT OR IGNORE INTO trip_families (trip_id, family_id)
          VALUES (?, ?)
        `).run(trip.id, famId);

        const members = req.db.prepare(`
          SELECT person_id FROM family_memberships
          WHERE family_id = ? AND left_at IS NULL
        `).all(famId) as Array<{ person_id: number }>;

        for (const m of members) {
          const existing = req.db.prepare(`
            SELECT id FROM trip_participants WHERE trip_id = ? AND person_id = ?
          `).get(trip.id, m.person_id);

          if (!existing) {
            req.db.prepare(`
              INSERT INTO trip_participants (trip_id, person_id, attendance)
              VALUES (?, ?, 'pending')
            `).run(trip.id, m.person_id);

            notifyTripParticipantAdded(req.db, {
              tripId: trip.id,
              personId: m.person_id,
              addedByUserId: req.user!.id,
              tripName: updatedName,
              tripDates: (updatedStart ? (updatedEnd ? `${updatedStart} to ${updatedEnd}` : updatedStart) : updatedDest) || undefined,
            });
          }
        }
      }
    }

    // If specific participant_person_ids provided
    if (data.participant_person_ids && data.participant_person_ids.length > 0) {
      for (const personId of data.participant_person_ids) {
        const existing = req.db.prepare(`
          SELECT id FROM trip_participants WHERE trip_id = ? AND person_id = ?
        `).get(trip.id, personId);

        if (!existing) {
          req.db.prepare(`
            INSERT INTO trip_participants (trip_id, person_id, attendance)
            VALUES (?, ?, 'pending')
          `).run(trip.id, personId);

          notifyTripParticipantAdded(req.db, {
            tripId: trip.id,
            personId,
            addedByUserId: req.user!.id,
            tripName: updatedName,
            tripDates: (updatedStart ? (updatedEnd ? `${updatedStart} to ${updatedEnd}` : updatedStart) : updatedDest) || undefined,
          });
        }
      }
    }

    recordAuditLog(req.db, req.user!.id, 'UPDATE_TRIP', 'trips', trip.id, trip, { name: updatedName, status: updatedStatus, isPrivate: updatedPrivate });
  });

  res.json({ message: 'Trip updated successfully' });
});

// POST /api/trips/:tripId/complete - Mark trip as completed
tripsRouter.post('/:tripId/complete', requireAuth, requireTripAccess('tripId'), (req: Request, res: Response) => {
  const trip = req.trip!;
  if (req.user!.role !== 'super_admin' && trip.created_by !== req.user!.id) {
    res.status(403).json({ error: 'FORBIDDEN', message: 'Only trip creator or super admin can mark trip as completed' });
    return;
  }

  const completedAt = new Date().toISOString();
  req.db.prepare(`
    UPDATE trips
    SET status = 'completed', completed_at = ?
    WHERE id = ?
  `).run(completedAt, trip.id);

  recordAuditLog(req.db, req.user!.id, 'COMPLETE_TRIP', 'trips', trip.id, { status: trip.status }, { status: 'completed', completedAt });

  res.json({ message: 'Trip marked as completed', completed_at: completedAt });
});

// POST /api/trips/:tripId/participants - Add participant to trip
tripsRouter.post('/:tripId/participants', requireAuth, requireTripAccess('tripId'), (req: Request, res: Response) => {
  const { person_id } = req.body;
  const personId = Number(person_id);
  if (!personId || isNaN(personId)) {
    res.status(400).json({ error: 'BAD_REQUEST', message: 'Valid person_id required' });
    return;
  }

  const trip = req.trip!;
  withTransaction(req.db, () => {
    req.db.prepare(`
      INSERT OR IGNORE INTO trip_participants (trip_id, person_id, attendance)
      VALUES (?, ?, 'pending')
    `).run(trip.id, personId);

    notifyTripParticipantAdded(req.db, {
      tripId: trip.id,
      personId,
      addedByUserId: req.user!.id,
      tripName: trip.name,
      tripDates: trip.start_date ? (trip.end_date ? `${trip.start_date} to ${trip.end_date}` : trip.start_date) : (trip.destination || undefined),
    });
  });

  res.json({ message: 'Participant added' });
});

// POST /api/trips/:tripId/families - Add family to trip
tripsRouter.post('/:tripId/families', requireAuth, requireTripAccess('tripId'), (req: Request, res: Response) => {
  const { family_id } = req.body;
  const familyId = Number(family_id);
  if (!familyId || isNaN(familyId)) {
    res.status(400).json({ error: 'BAD_REQUEST', message: 'Valid family_id required' });
    return;
  }

  const trip = req.trip!;
  withTransaction(req.db, () => {
    req.db.prepare(`
      INSERT OR IGNORE INTO trip_families (trip_id, family_id)
      VALUES (?, ?)
    `).run(trip.id, familyId);

    // Also add family members to trip_participants and notify
    const members = req.db.prepare(`
      SELECT person_id FROM family_memberships
      WHERE family_id = ? AND left_at IS NULL
    `).all(familyId) as Array<{ person_id: number }>;

    for (const m of members) {
      req.db.prepare(`
        INSERT OR IGNORE INTO trip_participants (trip_id, person_id, attendance)
        VALUES (?, ?, 'pending')
      `).run(trip.id, m.person_id);

      notifyTripParticipantAdded(req.db, {
        tripId: trip.id,
        personId: m.person_id,
        addedByUserId: req.user!.id,
        tripName: trip.name,
        tripDates: trip.start_date ? (trip.end_date ? `${trip.start_date} to ${trip.end_date}` : trip.start_date) : (trip.destination || undefined),
      });
    }
  });

  res.json({ message: 'Family and members added to trip' });
});

// ----------------------------------------------------------------------------
// TRIP VISITING PLACES & ROUTE ITINERARY
// ----------------------------------------------------------------------------

const createPlaceSchema = z.object({
  name: z.string().trim().min(1).max(150),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  notes: z.string().trim().max(500).optional().nullable(),
  planned_date: z.string().trim().optional().nullable(),
});

// GET /api/trips/:tripId/places - Retrieve all visiting places in itinerary order
tripsRouter.get('/:tripId/places', requireAuth, requireTripAccess('tripId'), (req: Request, res: Response) => {
  const trip = req.trip!;
  const places = req.db.prepare(`
    SELECT tp.id, tp.trip_id, tp.name, tp.latitude, tp.longitude,
           tp.order_index, tp.notes, tp.planned_date, tp.created_by,
           tp.created_at, tp.updated_at,
           u.email as creator_email
    FROM trip_places tp
    LEFT JOIN users u ON tp.created_by = u.id
    WHERE tp.trip_id = ?
    ORDER BY tp.order_index ASC, tp.id ASC
  `).all(trip.id);

  const canEdit = req.user!.role === 'super_admin' || trip.created_by === req.user!.id;

  res.json({
    places,
    canEdit,
    tripId: trip.id,
    destination: trip.destination,
  });
});

// POST /api/trips/:tripId/places - Add a new visiting place (authorized trip creator or super admin only)
tripsRouter.post('/:tripId/places', requireAuth, requireTripAccess('tripId'), (req: Request, res: Response) => {
  const trip = req.trip!;
  const isAuthorized = req.user!.role === 'super_admin' || trip.created_by === req.user!.id;
  if (!isAuthorized) {
    res.status(403).json({ error: 'FORBIDDEN', message: 'Only the trip creator or super admin can edit trip route and places' });
    return;
  }

  const parseResult = createPlaceSchema.safeParse(req.body);
  if (!parseResult.success) {
    res.status(400).json({ error: 'VALIDATION_ERROR', details: parseResult.error.format() });
    return;
  }

  const { name, latitude, longitude, notes, planned_date } = parseResult.data;

  // Compute next order index
  const maxOrderRow = req.db.prepare(`
    SELECT COALESCE(MAX(order_index), -1) as max_order
    FROM trip_places
    WHERE trip_id = ?
  `).get(trip.id) as { max_order: number };

  const nextOrder = maxOrderRow.max_order + 1;

  const insertRes = req.db.prepare(`
    INSERT INTO trip_places (trip_id, name, latitude, longitude, order_index, notes, planned_date, created_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(trip.id, name, latitude, longitude, nextOrder, notes || null, planned_date || null, req.user!.id);

  const newPlace = req.db.prepare('SELECT * FROM trip_places WHERE id = ?').get(insertRes.lastInsertRowid);
  res.status(201).json(newPlace);
});

// PUT /api/trips/:tripId/places/reorder - Reorder visiting places (authorized trip creator or super admin only)
tripsRouter.put('/:tripId/places/reorder', requireAuth, requireTripAccess('tripId'), (req: Request, res: Response) => {
  const trip = req.trip!;
  const isAuthorized = req.user!.role === 'super_admin' || trip.created_by === req.user!.id;
  if (!isAuthorized) {
    res.status(403).json({ error: 'FORBIDDEN', message: 'Only the trip creator or super admin can reorder trip places' });
    return;
  }

  const { place_ids } = req.body;
  if (!Array.isArray(place_ids)) {
    res.status(400).json({ error: 'BAD_REQUEST', message: 'place_ids array is required' });
    return;
  }

  withTransaction(req.db, () => {
    place_ids.forEach((placeId, index) => {
      req.db.prepare(`
        UPDATE trip_places
        SET order_index = ?, updated_at = datetime('now')
        WHERE id = ? AND trip_id = ?
      `).run(index, Number(placeId), trip.id);
    });
  });

  const updatedPlaces = req.db.prepare(`
    SELECT * FROM trip_places
    WHERE trip_id = ?
    ORDER BY order_index ASC, id ASC
  `).all(trip.id);

  res.json({ message: 'Places reordered successfully', places: updatedPlaces });
});

// DELETE /api/trips/:tripId/places/:placeId - Remove a visiting place (authorized trip creator or super admin only)
tripsRouter.delete('/:tripId/places/:placeId', requireAuth, requireTripAccess('tripId'), (req: Request, res: Response) => {
  const trip = req.trip!;
  const isAuthorized = req.user!.role === 'super_admin' || trip.created_by === req.user!.id;
  if (!isAuthorized) {
    res.status(403).json({ error: 'FORBIDDEN', message: 'Only the trip creator or super admin can remove trip places' });
    return;
  }

  const placeId = Number(req.params.placeId);
  const existing = req.db.prepare('SELECT id FROM trip_places WHERE id = ? AND trip_id = ?').get(placeId, trip.id);
  if (!existing) {
    res.status(404).json({ error: 'NOT_FOUND', message: 'Visiting place not found for this trip' });
    return;
  }

  req.db.prepare('DELETE FROM trip_places WHERE id = ? AND trip_id = ?').run(placeId, trip.id);
  res.json({ message: 'Visiting place removed successfully', id: placeId });
});

