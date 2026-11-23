import { NextResponse } from 'next/server';
import { asc, sql } from 'drizzle-orm';
import { getDb } from '@/lib/database/client';
import { notes } from '@/lib/database/schema';

export const dynamic = 'force-dynamic';

/**
 * Lightweight note index (id + title) — used to resolve [[wikilinks]]
 * without shipping full note content.
 */
export async function GET() {
  try {
    const db = getDb();
    const rows = db
      .select({ id: notes.id, title: notes.title })
      .from(notes)
      .orderBy(asc(sql`${notes.title} COLLATE NOCASE`))
      .all();
    return NextResponse.json(rows);
  } catch (err) {
    console.error('GET /api/notes/index failed:', err instanceof Error ? err.message : err);
    return NextResponse.json({ error: 'Failed to load note index' }, { status: 500 });
  }
}
