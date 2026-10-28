import { Request, Response, NextFunction } from 'express';
import { DatabaseSync } from 'node:sqlite';
import { getDb } from '../db/connection';
import { validateSession } from './session';
import { User, Person, Family, UserRole, Trip } from '../types';

declare global {
  namespace Express {
    interface Request {
      db: DatabaseSync;
      user?: User;
      person?: Person | null;
      family?: Family | null;
      sessionToken?: string;
      trip?: Trip;
    }
  }
}

export function attachDbAndSession(req: Request, _res: Response, next: NextFunction): void {
  const db = getDb();
  req.db = db;

  // Extract session token from cookie or Authorization header
  let token: string | undefined;
  if (req.cookies && req.cookies.session_token) {
    token = req.cookies.session_token;
  } else if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
    token = req.headers.authorization.slice(7).trim();
  }

  if (token) {
    const session = validateSession(db, token);
    if (session) {
      req.user = session.user;
      req.person = session.person;
      req.family = session.family;
      req.sessionToken = token;
    }
  }

  next();
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  if (!req.user) {
    res.status(401).json({ error: 'UNAUTHORIZED', message: 'Authentication required' });
    return;
  }
  next();
}

export function requireRole(...roles: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: 'UNAUTHORIZED', message: 'Authentication required' });
      return;
    }
    if (!roles.includes(req.user.role)) {
      res.status(403).json({ error: 'FORBIDDEN', message: 'Insufficient permissions for this action' });
      return;
    }
    next();
  };
}

export function requireFamilyAccess(paramName = 'familyId') {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: 'UNAUTHORIZED', message: 'Authentication required' });
      return;
    }
    if (req.user.role === 'super_admin') {
      next();
      return;
    }

    const familyIdStr = req.params[paramName] || req.body.family_id;
    const targetFamilyId = Number(familyIdStr);
    if (!targetFamilyId || isNaN(targetFamilyId)) {
      res.status(400).json({ error: 'BAD_REQUEST', message: 'Valid family ID required' });
      return;
    }

    // Check if user is admin of target family
    const familyRow = req.db.prepare('SELECT id, admin_user_id FROM families WHERE id = ?').get(targetFamilyId) as { id: number; admin_user_id: number | null } | undefined;
    if (!familyRow) {
      res.status(404).json({ error: 'NOT_FOUND', message: 'Family not found' });
      return;
    }

    if (familyRow.admin_user_id === req.user.id) {
      next();
      return;
    }

    // Check if user's person belongs to this family
    if (req.person) {
      const membership = req.db.prepare(`
        SELECT id FROM family_memberships
        WHERE family_id = ? AND person_id = ? AND left_at IS NULL
      `).get(targetFamilyId, req.person.id);

      if (membership) {
        next();
        return;
      }
    }

    res.status(403).json({ error: 'FORBIDDEN', message: 'Access to this family is restricted' });
  };
}

export function requireTripAccess(paramName = 'tripId') {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: 'UNAUTHORIZED', message: 'Authentication required' });
      return;
    }

    const tripId = Number(req.params[paramName]);
    if (!tripId || isNaN(tripId)) {
      res.status(400).json({ error: 'BAD_REQUEST', message: 'Valid trip ID required' });
      return;
    }

    const trip = req.db.prepare(`
      SELECT id, name, destination, start_date, end_date, description, notes, cover_image, budget_paise, status, is_private, created_by, completed_at, created_at
      FROM trips
      WHERE id = ?
    `).get(tripId) as Trip | undefined;

    if (!trip) {
      res.status(404).json({ error: 'NOT_FOUND', message: 'Trip not found' });
      return;
    }

    req.trip = trip;

    // Super admin or creator has unconditional access
    if (req.user.role === 'super_admin' || trip.created_by === req.user.id) {
      next();
      return;
    }

    // Check membership in trip_participants
    let isParticipant = false;
    let attendanceStatus: string | null = null;

    if (req.person) {
      const pRow = req.db.prepare(`
        SELECT attendance FROM trip_participants
        WHERE trip_id = ? AND person_id = ?
      `).get(tripId, req.person.id) as { attendance: string } | undefined;

      if (pRow) {
        isParticipant = true;
        attendanceStatus = pRow.attendance;
      }
    }

    // Check membership in trip_families
    let isInTripFamily = false;
    if (req.family) {
      const fRow = req.db.prepare(`
        SELECT 1 FROM trip_families
        WHERE trip_id = ? AND family_id = ?
      `).get(tripId, req.family.id);

      if (fRow) {
        isInTripFamily = true;
      }
    }

    if (!isParticipant && !isInTripFamily) {
      res.status(403).json({ error: 'FORBIDDEN', message: 'You do not have access to this trip' });
      return;
    }

    // Restriction for private completed trips:
    // Only people who actually attended (attendance = 'coming') or trip creator/super-admin can access.
    if (trip.is_private === 1 && trip.status === 'completed') {
      if (attendanceStatus !== 'coming') {
        res.status(403).json({
          error: 'RESTRICTED_COMPLETED_TRIP',
          message: 'Access to this completed private trip is restricted to confirmed attendees.'
        });
        return;
      }
    }

    next();
  };
}
