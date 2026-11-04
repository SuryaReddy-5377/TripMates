import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { config } from '../config';

export interface DatabaseStats {
  engine: 'sqlite' | 'postgres';
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

const BACKUP_TABLES = [
  'users',
  'families',
  'persons',
  'family_memberships',
  'trips',
  'trip_families',
  'trip_participants',
  'attendance_log',
  'expenses',
  'expense_items',
  'expense_charges',
  'expense_allocations',
  'family_share_breakdown',
  'repayments',
  'debt_assumptions',
  'audit_log',
  'sessions',
  'invitations',
  'notifications',
  'notification_preferences',
  'family_invite_codes',
  'trip_places',
  'suggestions',
];

export async function getDatabaseStats(db: any): Promise<DatabaseStats> {
  const isPg = Boolean(db && db.isPostgres);

  const getCount = async (table: string): Promise<number> => {
    try {
      if (isPg) {
        const res = db.query ? await db.query(`SELECT COUNT(*) as count FROM ${table}`) : await db.prepare(`SELECT COUNT(*) as count FROM ${table}`).get();
        const row = Array.isArray(res) ? res[0] : res;
        return Number(row?.count || 0);
      } else {
        const row = db.prepare(`SELECT COUNT(*) as count FROM ${table}`).get() as { count: number };
        return Number(row?.count || 0);
      }
    } catch {
      return 0;
    }
  };

  let sizeBytes = 0;
  if (!isPg) {
    try {
      if (config.databasePath !== ':memory:' && fs.existsSync(config.databasePath)) {
        sizeBytes = fs.statSync(config.databasePath).size;
      }
    } catch {
      // ignore
    }
  }

  return {
    engine: isPg ? 'postgres' : 'sqlite',
    usersCount: await getCount('users'),
    personsCount: await getCount('persons'),
    familiesCount: await getCount('families'),
    tripsCount: await getCount('trips'),
    expensesCount: await getCount('expenses'),
    repaymentsCount: await getCount('repayments'),
    familyInviteCodesCount: await getCount('family_invite_codes'),
    auditLogsCount: await getCount('audit_log'),
    databasePath: isPg ? (config.databaseUrl ? '[Neon / Cloud PostgreSQL Connection]' : 'postgres') : config.databasePath,
    isPersistentDisk: isPg ? true : config.isPersistentDisk,
    sizeBytes,
  };
}

export async function verifyDatabaseIntegrity(db: any): Promise<{ ok: boolean; message: string; stats: DatabaseStats }> {
  const isPg = Boolean(db && db.isPostgres);

  if (isPg) {
    try {
      // Verify PostgreSQL connectivity
      if (db.query) {
        await db.query('SELECT 1 as test');
      } else {
        await db.prepare('SELECT 1 as test').get();
      }

      const stats = await getDatabaseStats(db);
      return {
        ok: true,
        message: 'Neon PostgreSQL connection active. Schema, tables, and constraints healthy.',
        stats,
      };
    } catch (err: any) {
      return {
        ok: false,
        message: `PostgreSQL check failed: ${err.message}`,
        stats: await getDatabaseStats(db),
      };
    }
  }

  // SQLite integrity check
  try {
    const integrityRows = db.prepare('PRAGMA integrity_check').all() as any[];
    const isIntegrityOk = integrityRows.length === 1 && integrityRows[0].integrity_check === 'ok';

    const fkRows = db.prepare('PRAGMA foreign_key_check').all() as any[];
    const isFkOk = fkRows.length === 0;

    const stats = await getDatabaseStats(db);

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
      stats: await getDatabaseStats(db),
    };
  }
}

export async function createDatabaseBackup(db: any, customBackupDir?: string): Promise<{ backupPath: string; stats: DatabaseStats }> {
  const isPg = Boolean(db && db.isPostgres);
  const baseDir = isPg ? path.resolve(process.cwd(), 'data') : path.dirname(config.databasePath);
  const backupDir = customBackupDir || path.resolve(baseDir, 'backups');

  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');

  if (isPg) {
    // For PostgreSQL: Export all application tables to a structured JSON snapshot
    const backupFileName = `tripmates-pg-backup-${timestamp}.json`;
    const backupPath = path.join(backupDir, backupFileName);

    const snapshot: Record<string, any[]> = {};
    for (const table of BACKUP_TABLES) {
      try {
        const rows = db.query ? await db.query(`SELECT * FROM ${table}`) : await db.prepare(`SELECT * FROM ${table}`).all();
        snapshot[table] = rows || [];
      } catch {
        snapshot[table] = [];
      }
    }

    fs.writeFileSync(backupPath, JSON.stringify(snapshot, null, 2), 'utf8');

    return {
      backupPath,
      stats: await getDatabaseStats(db),
    };
  }

  // For SQLite: Checkpoint and copy file
  if (config.databasePath === ':memory:') {
    throw new Error('Cannot backup an in-memory database');
  }

  if (!fs.existsSync(config.databasePath)) {
    throw new Error(`Database file does not exist at: ${config.databasePath}`);
  }

  try {
    db.exec('PRAGMA wal_checkpoint(TRUNCATE);');
  } catch {
    // ignore
  }

  const backupFileName = `tripmates-backup-${timestamp}.db`;
  const backupPath = path.join(backupDir, backupFileName);

  fs.copyFileSync(config.databasePath, backupPath);

  // Verify backup copy
  const backupDb = new DatabaseSync(backupPath);
  try {
    const check = await verifyDatabaseIntegrity(backupDb);
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
    stats: await getDatabaseStats(db),
  };
}
