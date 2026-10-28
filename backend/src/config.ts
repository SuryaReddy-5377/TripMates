import dotenv from 'dotenv';
import path from 'node:path';
import crypto from 'node:crypto';

dotenv.config();

export const config = {
  port: Number(process.env.PORT || 4000),
  databasePath: process.env.DATABASE_PATH || path.resolve(process.cwd(), 'data', 'tripmates.db'),
  sessionSecret: process.env.SESSION_SECRET || 'tripmates-default-secret-' + crypto.randomBytes(16).toString('hex'),
  nodeEnv: process.env.NODE_ENV || 'development',
  corsOrigin: process.env.CORS_ORIGIN || true,
};
