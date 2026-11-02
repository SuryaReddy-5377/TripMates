import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import { AsyncLocalStorage } from 'node:async_hooks';
import pg from 'pg';
import { config } from '../config';

// Parse int8 (BIGINT) as JavaScript integer numbers so currency calculations in paise remain precise
pg.types.setTypeParser(20, (val) => (val === null ? null : parseInt(val, 10)));

export interface PreparedStatement {
  all(...params: any[]): any;
  get(...params: any[]): any;
  run(...params: any[]): any;
}

export interface AnyDb {
  isPostgres: boolean;
  prepare(sql: string): PreparedStatement;
  exec(sql: string): any;
  query?<T = any>(sql: string, params?: any[]): Promise<T[]>;
  pool?: pg.Pool;
  sqlite?: DatabaseSync;
}

const txStorage = new AsyncLocalStorage<pg.PoolClient>();

const TABLES_WITHOUT_ID = new Set([
  'trip_families',
  'trip_participants',
  'notification_preferences',
  'schema_migrations',
]);

export function translateToPg(sql: string): { sql: string; isInsert: boolean } {
  let translated = sql;

  // 1. Remove SQLite COLLATE NOCASE
  translated = translated.replace(/\s+COLLATE\s+NOCASE/gi, '');

  // 2. Replace datetime('now') -> CURRENT_TIMESTAMP
  translated = translated.replace(/datetime\('now'\)/gi, 'CURRENT_TIMESTAMP');

  // 3. Replace datetime(expression) -> expression
  translated = translated.replace(/datetime\(([^)]+)\)/gi, '$1');

  // 4. Handle INSERT OR IGNORE INTO
  const hadInsertOrIgnore = /INSERT\s+OR\s+IGNORE\s+INTO/i.test(translated);
  if (hadInsertOrIgnore) {
    translated = translated.replace(/INSERT\s+OR\s+IGNORE\s+INTO/gi, 'INSERT INTO');
  }

  // 5. If INSERT statement without RETURNING, append RETURNING id ONLY if table has an id column
  const insertMatch = translated.match(/^\s*INSERT\s+INTO\s+([a-zA-Z0-9_]+)/i);
  const isInsert = Boolean(insertMatch);
  if (isInsert && !/\bRETURNING\b/i.test(translated)) {
    const tableName = insertMatch![1].toLowerCase();
    const hasNoId = TABLES_WITHOUT_ID.has(tableName);
    if (hadInsertOrIgnore && !/\bON\s+CONFLICT\b/i.test(translated)) {
      translated = translated.trim() + (hasNoId ? ' ON CONFLICT DO NOTHING' : ' ON CONFLICT DO NOTHING RETURNING id');
    } else if (!hasNoId) {
      translated = translated.trim() + ' RETURNING id';
    }
  }

  // 6. Convert ? parameter placeholders to $1, $2, $3, ...
  let paramIndex = 1;
  let inString = false;
  let out = '';
  for (let i = 0; i < translated.length; i++) {
    const char = translated[i];
    if (char === "'") {
      inString = !inString;
      out += char;
    } else if (char === '?' && !inString) {
      out += '$' + (paramIndex++);
    } else {
      out += char;
    }
  }

  return { sql: out, isInsert };
}

class PostgresAdapter implements AnyDb {
  public isPostgres = true;
  constructor(public pool: pg.Pool) {}

  private getClient(): pg.Pool | pg.PoolClient {
    return txStorage.getStore() || this.pool;
  }

  public prepare(sql: string): PreparedStatement {
    const { sql: pgSql } = translateToPg(sql);
    const self = this;

    return {
      async all(...params: any[]) {
        const client = self.getClient();
        const flatParams = params.length === 1 && Array.isArray(params[0]) ? params[0] : params;
        const res = await client.query(pgSql, flatParams);
        return res.rows;
      },
      async get(...params: any[]) {
        const client = self.getClient();
        const flatParams = params.length === 1 && Array.isArray(params[0]) ? params[0] : params;
        const res = await client.query(pgSql, flatParams);
        return res.rows[0] || null;
      },
      async run(...params: any[]) {
        const client = self.getClient();
        const flatParams = params.length === 1 && Array.isArray(params[0]) ? params[0] : params;
        const res = await client.query(pgSql, flatParams);
        const row = res.rows[0];
        const lastInsertRowid = row && row.id !== undefined ? Number(row.id) : (row ? Number(Object.values(row)[0]) : 0);
        return {
          changes: res.rowCount || 0,
          lastInsertRowid,
        };
      },
    };
  }

  public async exec(sql: string): Promise<void> {
    const client = this.getClient();
    await client.query(sql);
  }

  public async query<T = any>(sql: string, params: any[] = []): Promise<T[]> {
    const client = this.getClient();
    const res = await client.query(sql, params);
    return res.rows as T[];
  }
}

class SqliteAdapter implements AnyDb {
  public isPostgres = false;
  constructor(public sqlite: DatabaseSync) {}

  public prepare(sql: string): PreparedStatement {
    const stmt = this.sqlite.prepare(sql);
    return {
      all: (...params: any[]) => {
        const flatParams = params.length === 1 && Array.isArray(params[0]) ? params[0] : params;
        return stmt.all(...flatParams);
      },
      get: (...params: any[]) => {
        const flatParams = params.length === 1 && Array.isArray(params[0]) ? params[0] : params;
        return stmt.get(...flatParams) || null;
      },
      run: (...params: any[]) => {
        const flatParams = params.length === 1 && Array.isArray(params[0]) ? params[0] : params;
        const res = stmt.run(...flatParams);
        return {
          changes: Number(res.changes),
          lastInsertRowid: Number(res.lastInsertRowid),
        };
      },
    };
  }

  public exec(sql: string): void {
    this.sqlite.exec(sql);
  }
}

let globalDb: AnyDb | null = null;
let globalPool: pg.Pool | null = null;

export function getDb(customPath?: string): AnyDb {
  if (customPath) {
    const db = new DatabaseSync(customPath);
    db.exec('PRAGMA foreign_keys = ON;');
    return new SqliteAdapter(db);
  }

  if (!globalDb) {
    if (config.databaseUrl) {
      // Connect to PostgreSQL (Neon / Render Postgres)
      const isNeonOrCloud = config.databaseUrl.includes('neon.tech') ||
                            config.databaseUrl.includes('render.com') ||
                            config.nodeEnv === 'production';

      globalPool = new pg.Pool({
        connectionString: config.databaseUrl,
        ssl: isNeonOrCloud ? { rejectUnauthorized: false } : undefined,
        max: 10,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 30000,
      });

      globalDb = new PostgresAdapter(globalPool);
      console.log(`[Database] Connected to PostgreSQL managed database (Pool size: 10, SSL: ${isNeonOrCloud ? 'enabled' : 'disabled'})`);
    } else {
      // Connect to SQLite for local development or fallback
      const dbPath = config.databasePath;
      if (dbPath !== ':memory:') {
        const dir = path.dirname(dbPath);
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
        }
      }
      const rawDb = new DatabaseSync(dbPath);
      rawDb.exec('PRAGMA foreign_keys = ON;');
      if (dbPath !== ':memory:') {
        try {
          rawDb.exec('PRAGMA journal_mode = WAL;');
          rawDb.exec('PRAGMA synchronous = NORMAL;');
        } catch {
          // Ignore if filesystem doesn't support WAL
        }
        console.log(`[Database] Connected to SQLite database at: ${dbPath} (${config.isPersistentDisk ? 'Persistent Disk' : 'Local / Ephemeral Storage'})`);
      }
      globalDb = new SqliteAdapter(rawDb);
    }
  }

  return globalDb;
}

export function setDb(db: any): void {
  if (!db) {
    globalDb = null;
    return;
  }
  if (db.prepare && typeof db.prepare === 'function') {
    // If raw DatabaseSync passed, wrap in SqliteAdapter
    if (db instanceof DatabaseSync || !('isPostgres' in db)) {
      globalDb = new SqliteAdapter(db);
    } else {
      globalDb = db;
    }
  } else if (db instanceof pg.Pool) {
    globalDb = new PostgresAdapter(db);
  }
}

export function withTransaction<T>(db: AnyDb | DatabaseSync, callback: () => T | Promise<T>): any {
  const anyDb: AnyDb = (db instanceof DatabaseSync || !('isPostgres' in db))
    ? new SqliteAdapter(db as DatabaseSync)
    : (db as AnyDb);

  if (anyDb.isPostgres && anyDb.pool) {
    return (async () => {
      const client = await anyDb.pool!.connect();
      try {
        await client.query('BEGIN');
        const result = await txStorage.run(client, () => Promise.resolve(callback()));
        await client.query('COMMIT');
        return result;
      } catch (err) {
        try {
          await client.query('ROLLBACK');
        } catch {
          // ignore
        }
        throw err;
      } finally {
        client.release();
      }
    })();
  }

  // SQLite transaction
  anyDb.exec('BEGIN');
  try {
    const result = callback();
    if (result && typeof (result as any).then === 'function') {
      return (result as any).then(
        (val: any) => {
          anyDb.exec('COMMIT');
          return val;
        },
        (err: any) => {
          try {
            anyDb.exec('ROLLBACK');
          } catch {
            // ignore
          }
          throw err;
        }
      );
    }
    anyDb.exec('COMMIT');
    return result;
  } catch (err) {
    try {
      anyDb.exec('ROLLBACK');
    } catch {
      // ignore
    }
    throw err;
  }
}

export async function closeDb(): Promise<void> {
  if (globalPool) {
    await globalPool.end();
    globalPool = null;
  }
  globalDb = null;
}
