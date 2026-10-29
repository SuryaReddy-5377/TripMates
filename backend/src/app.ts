import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import path from 'node:path';
import fs from 'node:fs';

import { attachDbAndSession } from './auth/middleware';
import { authRouter } from './routes/auth.routes';
import { familiesRouter } from './routes/families.routes';
import { personsRouter } from './routes/persons.routes';
import { tripsRouter } from './routes/trips.routes';
import { attendanceRouter } from './routes/attendance.routes';
import { expensesRouter } from './routes/expenses.routes';
import { repaymentsRouter } from './routes/repayments.routes';
import { settlementsRouter } from './routes/settlements.routes';
import { reportsRouter } from './routes/reports.routes';
import { invitationsRouter, globalInvitationsRouter } from './routes/invitations.routes';
import { auditRouter } from './routes/audit.routes';
import { notificationsRouter } from './routes/notifications.routes';
import { adminRouter } from './routes/admin.routes';
import { suggestionsRouter } from './routes/suggestions.routes';

export function createApp(): Express {
  const app = express();

  app.use(cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps, curl) or localhost dev servers
      callback(null, true);
    },
    credentials: true,
  }));

  app.use(cookieParser());
  app.use(express.json());

  // Attach database and authenticate session
  app.use(attachDbAndSession);

  // Health check
  app.get('/api/health', (_req: Request, res: Response) => {
    res.json({ status: 'ok', service: 'tripmates-api', timestamp: new Date().toISOString() });
  });

  // Mount API routers
  app.use('/api/auth', authRouter);
  app.use('/api', authRouter); // Support direct /api/login, /api/signin, /api/register, /api/signup
  app.use('/api/admin', adminRouter);
  app.use('/api/suggestions', suggestionsRouter);
  app.use('/api/notifications', notificationsRouter);
  app.use('/api/families', familiesRouter);
  app.use('/api/persons', personsRouter);
  app.use('/api/trips', tripsRouter);
  app.use('/api/trips/:tripId/attendance', attendanceRouter);
  app.use('/api/trips/:tripId/expenses', expensesRouter);
  app.use('/api/trips/:tripId/repayments', repaymentsRouter);
  app.use('/api/trips/:tripId', settlementsRouter);
  app.use('/api/trips/:tripId/reports', reportsRouter);
  app.use('/api/trips/:tripId/invitations', invitationsRouter);
  app.use('/api/invitations', globalInvitationsRouter);
  app.use('/api/audit', auditRouter);

  // Serve static assets if frontend/dist exists
  const frontendDist = path.resolve(process.cwd(), 'frontend', 'dist');
  if (fs.existsSync(frontendDist)) {
    app.use(express.static(frontendDist));
    app.use((req: Request, res: Response, next: NextFunction) => {
      if (req.method === 'GET' && !req.path.startsWith('/api')) {
        res.sendFile(path.join(frontendDist, 'index.html'));
      } else {
        next();
      }
    });
  }

  // 404 handler for unmatched API routes
  app.use('/api', (_req: Request, res: Response) => {
    res.status(404).json({ error: 'NOT_FOUND', message: 'API route not found' });
  });

  // Error handling middleware
  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    console.error('Unhandled API error:', err);
    res.status(err.status || 500).json({
      error: err.code || 'INTERNAL_ERROR',
      message: err.message || 'An unexpected error occurred',
    });
  });

  return app;
}
