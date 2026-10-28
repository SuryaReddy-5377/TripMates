import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';

export function runMigrations(db: DatabaseSync, migrationsDir?: string): { applied: string[]; skipped: string[] } {
  const dir = migrationsDir || path.resolve(process.cwd(), 'database');
  if (!fs.existsSync(dir)) {
    throw new Error(`Migrations directory not found at: ${dir}`);
  }

  // Ensure migrations tracking table exists
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      name TEXT PRIMARY KEY,
      applied_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  const appliedRows = db.prepare('SELECT name FROM schema_migrations').all() as Array<{ name: string }>;
  const appliedSet = new Set(appliedRows.map(r => r.name));

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

    db.exec('BEGIN');
    try {
      db.exec(sql);
      db.prepare('INSERT INTO schema_migrations (name) VALUES (?)').run(file);
      db.exec('COMMIT');
      applied.push(file);
    } catch (err) {
      try {
        db.exec('ROLLBACK');
      } catch {
        // ignore
      }
      throw new Error(`Failed to apply migration ${file}: ${(err as Error).message}`);
    }
  }

  return { applied, skipped };
}
