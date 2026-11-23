import { describe, it, expect, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import { runMigrations, loadMigrations } from './migrate';

function freshDb(): Database.Database {
  const db = new Database(':memory:');
  db.pragma('foreign_keys = ON');
  return db;
}

describe('migration runner', () => {
  const open: Database.Database[] = [];
  afterEach(() => {
    while (open.length) open.pop()?.close();
  });

  it('loads migrations in version order', () => {
    const migrations = loadMigrations();
    expect(migrations.length).toBeGreaterThanOrEqual(2);
    expect(migrations[0].version).toBe(1);
    for (let i = 1; i < migrations.length; i++) {
      expect(migrations[i].version).toBeGreaterThan(migrations[i - 1].version);
    }
  });

  it('applies migrations and records user_version', () => {
    const db = freshDb();
    open.push(db);
    const applied = runMigrations(db);
    expect(applied).toBeGreaterThanOrEqual(2);
    expect(db.pragma('user_version', { simple: true })).toBeGreaterThanOrEqual(2);

    const tables = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
      .all() as { name: string }[];
    const names = tables.map((t) => t.name);
    for (const expected of [
      'notes',
      'tags',
      'note_tags',
      'collections',
      'documents',
      'flashcard_decks',
      'flashcards',
      'study_records',
      'ai_conversations',
      'ai_messages',
      'settings',
      'note_links',
      'notes_fts',
      'documents_fts',
    ]) {
      expect(names).toContain(expected);
    }
  });

  it('is idempotent — running twice applies nothing new', () => {
    const db = freshDb();
    open.push(db);
    runMigrations(db);
    const second = runMigrations(db);
    expect(second).toBe(0);
  });

  it('keeps the FTS index in sync via triggers', () => {
    const db = freshDb();
    open.push(db);
    runMigrations(db);

    db.prepare(
      `INSERT INTO notes (id, title, content, is_pinned, is_favorite, created_at, updated_at)
       VALUES ('n1', 'Kubernetes basics', 'Pods and services', 0, 0, 1000, 1000)`,
    ).run();

    const hit = db
      .prepare(
        `SELECT n.id FROM notes_fts JOIN notes n ON n.rowid = notes_fts.rowid
         WHERE notes_fts MATCH '"kubernetes"'`,
      )
      .all();
    expect(hit).toEqual([{ id: 'n1' }]);

    // Update → old term no longer matches, new term does
    db.prepare(`UPDATE notes SET content = 'Containers and deployments' WHERE id = 'n1'`).run();
    const oldHit = db
      .prepare(
        `SELECT COUNT(*) AS c FROM notes_fts WHERE notes_fts MATCH '"pods"'`,
      )
      .get() as { c: number };
    expect(oldHit.c).toBe(0);

    // Delete → FTS row removed
    db.prepare(`DELETE FROM notes WHERE id = 'n1'`).run();
    const afterDelete = db
      .prepare(`SELECT COUNT(*) AS c FROM notes_fts WHERE notes_fts MATCH '"kubernetes"'`)
      .get() as { c: number };
    expect(afterDelete.c).toBe(0);
  });

  it('enforces foreign keys (cascade deletes)', () => {
    const db = freshDb();
    open.push(db);
    runMigrations(db);
    db.prepare(
      `INSERT INTO notes (id, title, content, is_pinned, is_favorite, created_at, updated_at)
       VALUES ('n1', 'T', '', 0, 0, 1, 1)`,
    ).run();
    db.prepare(`INSERT INTO tags (id, name, created_at) VALUES ('t1', 'x', 1)`).run();
    db.prepare(`INSERT INTO note_tags (note_id, tag_id) VALUES ('n1', 't1')`).run();

    db.prepare(`DELETE FROM notes WHERE id = 'n1'`).run();
    const orphans = db.prepare(`SELECT COUNT(*) AS c FROM note_tags`).get() as { c: number };
    expect(orphans.c).toBe(0);
  });
});
