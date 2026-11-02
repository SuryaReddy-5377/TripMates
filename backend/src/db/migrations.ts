import fs from 'node:fs';
import path from 'node:path';
import { AnyDb } from './connection';

export function runMigrations(db: any, migrationsDir?: string): any {
  if (db && db.isPostgres) {
    return runPostgresMigrations(db, migrationsDir);
  }
  return runSqliteMigrations(db, migrationsDir);
}

function runSqliteMigrations(db: any, migrationsDir?: string): { applied: string[]; skipped: string[] } {
  const sqlite = db.sqlite || db;
  const dir = migrationsDir || path.resolve(process.cwd(), 'database');
  if (!fs.existsSync(dir)) {
    throw new Error(`Migrations directory not found at: ${dir}`);
  }

  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      name TEXT PRIMARY KEY,
      applied_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  const appliedRows = sqlite.prepare('SELECT name FROM schema_migrations').all() as Array<{ name: string }>;
  const appliedSet = new Set(appliedRows.map((r: any) => r.name));

  const files = fs.readdirSync(dir)
    .filter(f => f.endsWith('.sql'))
    .sort();

  const applied: string[] = [];
  const skipped: string[] = [];

  for (const file of files) {
    if (appliedSet.has(file)) {
      skipped.push(file);
      continue;
    }

    const filePath = path.join(dir, file);
    const sql = fs.readFileSync(filePath, 'utf8');

    sqlite.exec('BEGIN');
    try {
      sqlite.exec(sql);
      sqlite.prepare('INSERT INTO schema_migrations (name) VALUES (?)').run(file);
      sqlite.exec('COMMIT');
      applied.push(file);
    } catch (err) {
      try {
        sqlite.exec('ROLLBACK');
      } catch {
        // ignore
      }
      throw new Error(`Failed to apply migration ${file}: ${(err as Error).message}`);
    }
  }

  return { applied, skipped };
}

export async function runPostgresMigrations(db: AnyDb, migrationsDir?: string): Promise<{ applied: string[]; skipped: string[] }> {
  const dir = migrationsDir || path.resolve(process.cwd(), 'database', 'postgres');
  if (!fs.existsSync(dir)) {
    throw new Error(`PostgreSQL migrations directory not found at: ${dir}`);
  }

  const pool = db.pool!;
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        name TEXT PRIMARY KEY,
        applied_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);

    const res = await client.query('SELECT name FROM schema_migrations');
    const appliedSet = new Set(res.rows.map((r: any) => r.name));

    const files = fs.readdirSync(dir)
      .filter(f => f.endsWith('.sql'))
      .sort();

    const applied: string[] = [];
    const skipped: string[] = [];

    for (const file of files) {
      if (appliedSet.has(file)) {
        skipped.push(file);
        continue;
      }

      const filePath = path.join(dir, file);
      const sql = fs.readFileSync(filePath, 'utf8');

      await client.query('BEGIN');
      try {
        await client.query(sql);
        await client.query('INSERT INTO schema_migrations (name) VALUES ($1)', [file]);
        await client.query('COMMIT');
        applied.push(file);
        console.log(`[PostgreSQL Migration] Successfully applied ${file}`);
      } catch (err) {
        await client.query('ROLLBACK');
        throw new Error(`Failed to apply PostgreSQL migration ${file}: ${(err as Error).message}`);
      }
    }

    // Ensure cover_image column exists on trips (in case 005 previously ran with cover_image_url)
    try {
      await client.query('ALTER TABLE trips ADD COLUMN IF NOT EXISTS cover_image TEXT');
      await client.query(`
        DO $$
        BEGIN
          IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='trips' AND column_name='cover_image_url') THEN
            UPDATE trips SET cover_image = cover_image_url WHERE cover_image IS NULL AND cover_image_url IS NOT NULL;
          END IF;
        END $$;
      `);
    } catch {
      // Ignore if table doesn't exist yet or column already updated
    }

    // Ensure sender_name, sender_email exist on suggestions (in case 006 previously ran without them)
    try {
      await client.query('ALTER TABLE suggestions ADD COLUMN IF NOT EXISTS sender_name TEXT');
      await client.query('ALTER TABLE suggestions ADD COLUMN IF NOT EXISTS sender_email TEXT');
      await client.query(`
        DO $$
        BEGIN
          ALTER TABLE suggestions DROP CONSTRAINT IF EXISTS suggestions_status_check;
          ALTER TABLE suggestions ADD CONSTRAINT suggestions_status_check CHECK (status IN ('pending', 'reviewed', 'resolved', 'open', 'planned', 'dismissed'));
        EXCEPTION
          WHEN OTHERS THEN NULL;
        END $$;
      `);
      await client.query(`
        UPDATE suggestions s
        SET 
          sender_name = COALESCE(s.sender_name, p.display_name, 'User'),
          sender_email = COALESCE(s.sender_email, u.email, 'user@tripmates.local')
        FROM users u
        LEFT JOIN persons p ON p.user_id = u.id
        WHERE s.user_id = u.id AND (s.sender_name IS NULL OR s.sender_email IS NULL);
      `);
    } catch {
      // Ignore if table doesn't exist yet
    }

    return { applied, skipped };
  } finally {
    client.release();
  }
}
