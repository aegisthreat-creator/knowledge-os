import { sql } from 'drizzle-orm';
import { getDb, type Db } from '@/lib/database/client';
import { buildFtsQuery, matchedTerms } from './query';
import type {
  DocumentSearchHit,
  SearchHit,
  SearchProvider,
  SearchResponse,
  SearchScope,
  TagSearchHit,
} from './types';

export type { SearchScope };

function cleanSnippet(raw: string | null, fallback: string, maxLen = 200): string {
  const text = (raw ?? '').replace(/\s+/g, ' ').trim();
  const source = text || fallback.replace(/\s+/g, ' ').trim();
  if (source.length <= maxLen) return source;
  return `${source.slice(0, maxLen).trimEnd()}…`;
}

function searchNotes(
  db: Db,
  query: string,
  limit: number,
): SearchHit[] {
  const match = buildFtsQuery(query);
  if (!match) return [];
  const rows = db.all(
    sql`
      SELECT n.id AS id,
             n.title AS title,
             n.content AS content,
             n.updated_at AS updated_at,
             snippet(notes_fts, 1, '', '', '…', 16) AS snip,
             bm25(notes_fts, 8.0, 1.0) AS rank
      FROM notes_fts
      JOIN notes n ON n.rowid = notes_fts.rowid
      WHERE notes_fts MATCH ${match}
      ORDER BY rank
      LIMIT ${limit}
    `,
  ) as {
    id: string;
    title: string;
    content: string;
    updated_at: number;
    snip: string | null;
    rank: number;
  }[];

  const terms = matchedTerms(query);
  return rows.map((row) => ({
    id: row.id,
    title: row.title || 'Untitled',
    excerpt: cleanSnippet(row.snip, row.content),
    updatedAt: new Date(row.updated_at).toISOString(),
    highlights: terms,
    score: row.rank,
  }));
}

function searchDocuments(db: Db, query: string, limit: number): DocumentSearchHit[] {
  const match = buildFtsQuery(query);
  if (!match) return [];
  const rows = db.all(
    sql`
      SELECT d.id AS id,
             d.title AS title,
             d.original_name AS original_name,
             d.extracted_text AS extracted_text,
             d.updated_at AS updated_at,
             snippet(documents_fts, 2, '', '', '…', 16) AS snip,
             bm25(documents_fts, 6.0, 4.0, 1.0) AS rank
      FROM documents_fts
      JOIN documents d ON d.rowid = documents_fts.rowid
      WHERE documents_fts MATCH ${match}
      ORDER BY rank
      LIMIT ${limit}
    `,
  ) as {
    id: string;
    title: string;
    original_name: string;
    extracted_text: string | null;
    updated_at: number;
    snip: string | null;
    rank: number;
  }[];

  const terms = matchedTerms(query);
  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    name: row.original_name,
    excerpt: cleanSnippet(row.snip, row.extracted_text ?? ''),
    updatedAt: new Date(row.updated_at).toISOString(),
    highlights: terms,
    score: row.rank,
  }));
}

function searchTags(db: Db, query: string, limit: number): TagSearchHit[] {
  const q = query.trim().replace(/^#/, '').toLowerCase();
  if (!q) return [];
  // Escape LIKE wildcards; note '\\' in a template literal produces a single
  // backslash in the SQL text, which SQLite accepts as the ESCAPE character.
  const like = `%${q.replace(/[%_\\]/g, (m) => `\\${m}`)}%`;
  const rows = db.all(
    sql`
      SELECT t.id AS id, t.name AS name, COUNT(nt.note_id) AS count
      FROM tags t
      LEFT JOIN note_tags nt ON nt.tag_id = t.id
      WHERE t.name LIKE ${like} ESCAPE '\\'
      GROUP BY t.id
      ORDER BY count DESC, t.name ASC
      LIMIT ${limit}
    `,
  ) as { id: string; name: string; count: number }[];
  return rows;
}

/**
 * Local search provider backed by SQLite FTS5 (plus LIKE for tags).
 * Implements SearchProvider so a semantic provider can be added later.
 */
export class LocalSearchProvider implements SearchProvider {
  readonly id = 'local-fts5';

  async search(params: { query: string; limit?: number; scope?: SearchScope }): Promise<SearchResponse> {
    const { query, limit = 12, scope = 'all' } = params;
    const db = getDb();
    const trimmed = query.trim();

    const response: SearchResponse = {
      query: trimmed,
      notes: [],
      documents: [],
      tags: [],
    };
    if (trimmed.length === 0) return response;

    if (scope === 'all' || scope === 'notes') {
      response.notes = searchNotes(db, trimmed, limit);
    }
    if (scope === 'all' || scope === 'documents') {
      response.documents = searchDocuments(db, trimmed, limit);
    }
    if (scope === 'all' || scope === 'tags') {
      response.tags = searchTags(db, trimmed, limit);
    }
    return response;
  }
}

export const searchProvider: SearchProvider = new LocalSearchProvider();
