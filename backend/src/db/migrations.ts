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

    return { applied, skipped };
  } finally {
    client.release();
  }
}
