import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { config } from '../config';

export interface DatabaseStats {
  usersCount: number;
  personsCount: number;
  familiesCount: number;
  tripsCount: number;
  expensesCount: number;
  repaymentsCount: number;
  familyInviteCodesCount: number;
  auditLogsCount: number;
  databasePath: string;
  isPersistentDisk: boolean;
  sizeBytes: number;
}

export function getDatabaseStats(db: DatabaseSync): DatabaseStats {
  const getCount = (table: string): number => {
    try {
      const row = db.prepare(`SELECT COUNT(*) as count FROM ${table}`).get() as { count: number };
      return Number(row?.count || 0);
    } catch {
      return 0;
    }
  };

  let sizeBytes = 0;
  try {
    if (config.databasePath !== ':memory:' && fs.existsSync(config.databasePath)) {
      sizeBytes = fs.statSync(config.databasePath).size;
    }
  } catch {
    // ignore
  }

  return {
    usersCount: getCount('users'),
    personsCount: getCount('persons'),
    familiesCount: getCount('families'),
    tripsCount: getCount('trips'),
    expensesCount: getCount('expenses'),
    repaymentsCount: getCount('repayments'),
    familyInviteCodesCount: getCount('family_invite_codes'),
    auditLogsCount: getCount('audit_log'),
    databasePath: config.databasePath,
    isPersistentDisk: config.isPersistentDisk,
    sizeBytes,
  };
}

export function verifyDatabaseIntegrity(db: DatabaseSync): { ok: boolean; message: string; stats: DatabaseStats } {
  try {
    const integrityRows = db.prepare('PRAGMA integrity_check').all() as any[];
    const isIntegrityOk = integrityRows.length === 1 && integrityRows[0].integrity_check === 'ok';

    const fkRows = db.prepare('PRAGMA foreign_key_check').all() as any[];
    const isFkOk = fkRows.length === 0;

    const stats = getDatabaseStats(db);

    if (isIntegrityOk && isFkOk) {
      return { ok: true, message: 'Database integrity and foreign key checks passed cleanly.', stats };
    }

    return {
      ok: false,
      message: `Database verification failed. Integrity: ${integrityRows.map(r => r.integrity_check).join(', ')}. FK violations: ${fkRows.length}`,
      stats,
    };
  } catch (err: any) {
    return {
      ok: false,
      message: `Integrity check failed: ${err.message}`,
      stats: getDatabaseStats(db),
    };
  }
}

export function createDatabaseBackup(db: DatabaseSync, customBackupDir?: string): { backupPath: string; stats: DatabaseStats } {
  if (config.databasePath === ':memory:') {
    throw new Error('Cannot backup an in-memory database');
  }

  if (!fs.existsSync(config.databasePath)) {
    throw new Error(`Database file does not exist at: ${config.databasePath}`);
  }

  const backupDir = customBackupDir || path.resolve(path.dirname(config.databasePath), 'backups');
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }

  // Checkpoint WAL log into main DB file before copying
  try {
    db.exec('PRAGMA wal_checkpoint(TRUNCATE);');
  } catch {
    // ignore
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupFileName = `tripmates-backup-${timestamp}.db`;
  const backupPath = path.join(backupDir, backupFileName);

  fs.copyFileSync(config.databasePath, backupPath);

  // Verify backup copy
  const backupDb = new DatabaseSync(backupPath);
  try {
    const check = verifyDatabaseIntegrity(backupDb);
    if (!check.ok) {
      throw new Error(`Backup verification failed: ${check.message}`);
    }
  } finally {
    backupDb.close();
  }

  // Prune older backups if more than 15 exist
  try {
    const allFiles = fs.readdirSync(backupDir)
      .filter(f => f.startsWith('tripmates-backup-') && f.endsWith('.db'))
      .map(f => ({ name: f, path: path.join(backupDir, f), mtime: fs.statSync(path.join(backupDir, f)).mtime.getTime() }))
      .sort((a, b) => b.mtime - a.mtime);

    if (allFiles.length > 15) {
      for (const oldFile of allFiles.slice(15)) {
        try { fs.unlinkSync(oldFile.path); } catch { /* ignore */ }
      }
    }
  } catch {
    // ignore
  }

  return {
    backupPath,
    stats: getDatabaseStats(db),
  };
}

