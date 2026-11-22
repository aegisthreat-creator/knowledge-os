import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';
import { drizzle, type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import * as schema from './schema';
import { runMigrations } from './migrate';

export type Db = BetterSQLite3Database<typeof schema>;

export interface DatabaseHandle {
  sqlite: Database.Database;
  db: Db;
}

let cached: DatabaseHandle | null = null;

export function getDatabasePath(): string {
  const configured = process.env.DATABASE_PATH ?? 'data/knowledge.db';
  if (configured === ':memory:') return ':memory:';
  return path.isAbsolute(configured) ? configured : path.join(process.cwd(), configured);
}

/**
 * Open (and migrate) a SQLite database at `file`. Used by the app with the
 * configured path and by tests with ':memory:'.
 */
export function createDatabase(file: string): DatabaseHandle {
  if (file !== ':memory:') {
    const dir = path.dirname(file);
    fs.mkdirSync(dir, { recursive: true });
  }
  const sqlite = new Database(file);
  sqlite.pragma('journal_mode = WAL');
  sqlite.pragma('foreign_keys = ON');
  runMigrations(sqlite);
  const db = drizzle(sqlite, { schema });
  return { sqlite, db };
}

/** Process-wide database handle (created lazily, migrations run once). */
export function getDatabase(): DatabaseHandle {
  if (!cached) {
    cached = createDatabase(getDatabasePath());
  }
  return cached;
}

export function getDb(): Db {
  return getDatabase().db;
}

export function getSqlite(): Database.Database {
  return getDatabase().sqlite;
}

/** Close and drop the cached handle (used in tests). */
export function closeDatabase(): void {
  if (cached) {
    cached.sqlite.close();
    cached = null;
  }
}

/** Test hook: install (or clear) the process-wide handle explicitly. */
export function setDatabaseForTests(handle: DatabaseHandle | null): void {
  cached = handle;
}
