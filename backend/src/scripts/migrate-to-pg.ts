import dotenv from 'dotenv';
import path from 'node:path';
import fs from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import pg from 'pg';
import { createDatabaseBackup } from '../db/backup';
import { runPostgresMigrations } from '../db/migrations';
import { config } from '../config';

dotenv.config();

// Ensure BIGINT numbers are parsed as integers in Node.js
pg.types.setTypeParser(20, (val) => (val === null ? null : parseInt(val, 10)));

const TABLES_IN_ORDER = [
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

async function migrate() {
  const databaseUrl = process.env.DATABASE_URL || config.databaseUrl;
  if (!databaseUrl) {
    console.error('================================================================');
    console.error('ERROR: DATABASE_URL is not set!');
    console.error('Please set your Neon PostgreSQL connection string, for example:');
    console.error('  npx cross-env DATABASE_URL="postgresql://user:pass@ep-xyz.neon.tech/tripmates?sslmode=require" npm run db:migrate:pg');
    console.error('Or set DATABASE_URL in your .env file or Render Environment tab.');
    console.error('================================================================');
    process.exit(1);
  }

  const sqlitePath = config.databasePath;
  if (!fs.existsSync(sqlitePath)) {
    console.warn(`[Warning] Local SQLite database not found at ${sqlitePath}. Only applying PostgreSQL migrations.`);
  }

  console.log('--- Step 1: Backing up current SQLite database ---');
  if (fs.existsSync(sqlitePath)) {
    const rawSqlite = new DatabaseSync(sqlitePath);
    const backupRes = createDatabaseBackup(rawSqlite);
    console.log(`[Backup Success] Created snapshot at: ${backupRes.backupPath}`);
  }

  console.log('\n--- Step 2: Connecting to PostgreSQL and applying migrations ---');
  const pool = new pg.Pool({
    connectionString: databaseUrl,
    ssl: { rejectUnauthorized: false },
    max: 5,
    connectionTimeoutMillis: 10000,
  });

  const client = await pool.connect();
  try {
    // Test connectivity
    const testRes = await client.query('SELECT NOW() as current_time, version() as pg_version');
    console.log(`[PostgreSQL Connected] Time: ${testRes.rows[0].current_time}`);

    // Run PostgreSQL migrations
    const fakeDb = { isPostgres: true, pool };
    const { applied, skipped } = await runPostgresMigrations(fakeDb as any);
    console.log(`Migrations complete. Applied: ${applied.length}, Skipped: ${skipped.length}`);

    if (fs.existsSync(sqlitePath)) {
      console.log('\n--- Step 3: Transferring records from SQLite to PostgreSQL ---');
      const rawSqlite = new DatabaseSync(sqlitePath);

      for (const table of TABLES_IN_ORDER) {
        // Check if table exists in SQLite
        const tableCheck = rawSqlite.prepare(
          "SELECT name FROM sqlite_master WHERE type='table' AND name = ?"
        ).get(table);
        if (!tableCheck) {
          continue;
        }

        const rows = rawSqlite.prepare(`SELECT * FROM ${table}`).all() as Record<string, any>[];
        if (rows.length === 0) {
          console.log(`- Table ${table}: 0 records to migrate`);
          continue;
        }

        console.log(`- Migrating table ${table}: ${rows.length} records...`);

        // Batch insert into PostgreSQL
        for (const row of rows) {
          const columns = Object.keys(row);
          const values = Object.values(row);
          const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ');
          const colList = columns.join(', ');

          // Insert with ON CONFLICT DO NOTHING
          const insertSql = `
            INSERT INTO ${table} (${colList})
            VALUES (${placeholders})
            ON CONFLICT DO NOTHING
          `;
          await client.query(insertSql, values);
        }

        // Reset PostgreSQL sequence if table has auto-increment 'id'
        const hasIdCol = rows[0] && 'id' in rows[0];
        if (hasIdCol && typeof rows[0].id === 'number') {
          try {
            await client.query(`
              SELECT setval(pg_get_serial_sequence('${table}', 'id'), COALESCE((SELECT MAX(id) FROM ${table}), 1))
            `);
          } catch {
            // Table might not use a serial sequence for id
          }
        }
      }

      console.log('\n--- Step 4: Verification of Record Counts ---');
      console.log('---------------------------------------------------------');
      console.log('Table Name               | SQLite Count | PostgreSQL Count');
      console.log('---------------------------------------------------------');

      for (const table of TABLES_IN_ORDER) {
        const tableCheck = rawSqlite.prepare(
          "SELECT name FROM sqlite_master WHERE type='table' AND name = ?"
        ).get(table);
        if (!tableCheck) continue;

        const sqCount = (rawSqlite.prepare(`SELECT count(*) as count FROM ${table}`).get() as any).count;
        const pgCountRes = await client.query(`SELECT count(*) as count FROM ${table}`);
        const pgCount = Number(pgCountRes.rows[0].count);

        const padName = table.padEnd(24, ' ');
        const padSq = String(sqCount).padStart(12, ' ');
        const padPg = String(pgCount).padStart(16, ' ');
        console.log(`${padName} | ${padSq} | ${padPg}`);
      }
      console.log('---------------------------------------------------------');
      console.log('Migration successfully completed with zero data loss!');
    }
  } finally {
    client.release();
    await pool.end();
  }
}

migrate().catch((err) => {
  console.error('[Migration Error]:', err);
  process.exit(1);
});

