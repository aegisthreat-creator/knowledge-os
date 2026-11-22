import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { Database } from 'better-sqlite3';
import { createDatabase, setDatabaseForTests, type DatabaseHandle } from '@/lib/database/client';
import { LocalSearchProvider } from './search';

describe('LocalSearchProvider (FTS5)', () => {
  let handle: DatabaseHandle;
  let sqlite: Database;
  const provider = new LocalSearchProvider();

  beforeAll(() => {
    handle = createDatabase(':memory:');
    setDatabaseForTests(handle);
    sqlite = handle.sqlite;

    const insertNote = sqlite.prepare(
      `INSERT INTO notes (id, title, content, is_pinned, is_favorite, created_at, updated_at)
       VALUES (?, ?, ?, 0, 0, 1000, 1000)`,
    );
    insertNote.run('n1', 'Spaced repetition systems', 'Reviewing just before forgetting strengthens memory.');
    insertNote.run('n2', 'Cooking pasta', 'Salt the water generously before adding the spaghetti.');
    insertNote.run('n3', 'Quantum computing', 'Qubits use superposition and entanglement to compute.');

    const insertDoc = sqlite.prepare(
      `INSERT INTO documents (id, title, original_name, mime_type, size_bytes, storage_name,
        status, extracted_text, page_count, error_message, created_at, updated_at)
       VALUES (?, ?, ?, 'text/plain', 10, 'x.txt', 'extracted', ?, NULL, NULL, 1000, 1000)`,
    );
    insertDoc.run('d1', 'Lecture notes', 'lecture.txt', 'The hippocampus consolidates new memories during sleep.');
    insertDoc.run('d2', 'Broken scan', 'scan.pdf', '');

    sqlite
      .prepare(`INSERT INTO tags (id, name, created_at) VALUES ('t1', 'neuroscience', 1000)`)
      .run();
    sqlite
      .prepare(`INSERT INTO note_tags (note_id, tag_id) VALUES ('n1', 't1'), ('n3', 't1')`)
      .run();
  });

  afterAll(() => {
    setDatabaseForTests(null);
    handle.sqlite.close();
  });

  it('finds notes by title and content', async () => {
    const result = await provider.search({ query: 'spaced repetition' });
    expect(result.notes.length).toBeGreaterThan(0);
    expect(result.notes[0].id).toBe('n1');
    expect(result.notes[0].highlights).toContain('spaced');
  });

  it('supports prefix matching', async () => {
    const result = await provider.search({ query: 'cook' });
    expect(result.notes.some((n) => n.id === 'n2')).toBe(true);
  });

  it('finds documents by extracted text', async () => {
    const result = await provider.search({ query: 'hippocampus' });
    expect(result.documents).toHaveLength(1);
    expect(result.documents[0].id).toBe('d1');
  });

  it('finds tags with note counts', async () => {
    const result = await provider.search({ query: 'neuro' });
    expect(result.tags).toHaveLength(1);
    expect(result.tags[0]).toMatchObject({ name: 'neuroscience', count: 2 });
  });

  it('honors scope filtering', async () => {
    const notesOnly = await provider.search({ query: 'quantum', scope: 'notes' });
    expect(notesOnly.notes).toHaveLength(1);
    expect(notesOnly.documents).toHaveLength(0);
    expect(notesOnly.tags).toHaveLength(0);
  });

  it('returns empty results for an empty query', async () => {
    const result = await provider.search({ query: '   ' });
    expect(result.notes).toHaveLength(0);
    expect(result.documents).toHaveLength(0);
    expect(result.tags).toHaveLength(0);
  });

  it('returns nothing for terms that do not exist', async () => {
    const result = await provider.search({ query: 'zzzznotfound' });
    expect(result.notes).toHaveLength(0);
    expect(result.documents).toHaveLength(0);
  });
});
