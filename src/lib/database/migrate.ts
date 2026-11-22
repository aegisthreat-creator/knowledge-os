import fs from 'node:fs';
import path from 'node:path';
import type { Database } from 'better-sqlite3';

/**
 * Minimal, dependency-free migration runner.
 *
 * Migrations are plain .sql files in ./migrations named `NNNN_name.sql`.
 * The applied version is tracked in `PRAGMA user_version`; each migration
 * runs inside a transaction, so a failure never leaves a half-applied schema.
 */

export interface Migration {
  version: number;
  name: string;
  sql: string;
}

const MIGRATIONS_DIR = path.join(process.cwd(), 'src', 'lib', 'database', 'migrations');

export function loadMigrations(dir: string = MIGRATIONS_DIR): Migration[] {
  if (!fs.existsSync(dir)) return [];
  const migrations: Migration[] = [];
  for (const file of fs.readdirSync(dir)) {
    const match = /^(\d{4})_([a-z0-9_-]+)\.sql$/i.exec(file);
    if (!match) continue;
    migrations.push({
      version: Number.parseInt(match[1], 10),
      name: match[2],
      sql: fs.readFileSync(path.join(dir, file), 'utf8'),
    });
  }
  migrations.sort((a, b) => a.version - b.version);

  const seen = new Set<number>();
  for (const m of migrations) {
    if (seen.has(m.version)) {
      throw new Error(`Duplicate migration version: ${m.version} (${m.name})`);
    }
    seen.add(m.version);
  }
  return migrations;
}

export function runMigrations(db: Database, dir: string = MIGRATIONS_DIR): number {
  db.pragma('foreign_keys = ON');
  const current = db.pragma('user_version', { simple: true }) as number;
  const migrations = loadMigrations(dir);
  let applied = 0;

  for (const migration of migrations) {
    if (migration.version <= current) continue;
    const tx = db.transaction(() => {
      db.exec(migration.sql);
      db.pragma(`user_version = ${migration.version}`);
    });
    tx();
    applied += 1;
  }
  return applied;
}
