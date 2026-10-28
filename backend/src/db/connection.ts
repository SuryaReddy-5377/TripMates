import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import { config } from '../config';

let globalDb: DatabaseSync | null = null;

export function getDb(customPath?: string): DatabaseSync {
  if (customPath) {
    const db = new DatabaseSync(customPath);
    db.exec('PRAGMA foreign_keys = ON;');
    return db;
  }
  if (!globalDb) {
    const dbPath = config.databasePath;
    if (dbPath !== ':memory:') {
      const dir = path.dirname(dbPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    }
    globalDb = new DatabaseSync(dbPath);
    globalDb.exec('PRAGMA foreign_keys = ON;');
    if (dbPath !== ':memory:') {
      try {
        globalDb.exec('PRAGMA journal_mode = WAL;');
      } catch {
        // Fallback for filesystems that do not support WAL
      }
    }
  }
  return globalDb;
}

export function setDb(db: DatabaseSync | null): void {
  globalDb = db;
}

export function withTransaction<T>(db: DatabaseSync, callback: () => T): T {
  db.exec('BEGIN');
  try {
    const result = callback();
    db.exec('COMMIT');
    return result;
  } catch (err) {
    try {
      db.exec('ROLLBACK');
    } catch {
      // ignore rollback failure if transaction already aborted
    }
    throw err;
  }
}
