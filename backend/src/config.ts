import dotenv from 'dotenv';
import path from 'node:path';
import fs from 'node:fs';
import crypto from 'node:crypto';

dotenv.config();

function resolveDatabasePath(): { path: string; isPersistentDisk: boolean } {
  if (process.env.DATABASE_PATH) {
    return {
      path: path.resolve(process.env.DATABASE_PATH),
      isPersistentDisk: true,
    };
  }

  // Check common cloud persistent disk mount locations (e.g. Render /var/data or /data)
  const commonPersistentMounts = ['/var/data', '/data', '/mnt/data'];
  for (const mount of commonPersistentMounts) {
    try {
      if (fs.existsSync(mount) && fs.statSync(mount).isDirectory()) {
        return {
          path: path.join(mount, 'tripmates.db'),
          isPersistentDisk: true,
        };
      }
    } catch {
      // ignore
    }
  }

  // Default to local directory in project
  return {
    path: path.resolve(process.cwd(), 'data', 'tripmates.db'),
    isPersistentDisk: false,
  };
}

const dbInfo = resolveDatabasePath();

export const config = {
  port: Number(process.env.PORT || 4000),
  databasePath: dbInfo.path,
  isPersistentDisk: dbInfo.isPersistentDisk,
  sessionSecret: process.env.SESSION_SECRET || 'tripmates-default-secret-' + crypto.randomBytes(16).toString('hex'),
  nodeEnv: process.env.NODE_ENV || 'development',
  corsOrigin: process.env.CORS_ORIGIN || true,
};
