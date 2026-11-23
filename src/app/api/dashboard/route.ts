import { NextResponse } from 'next/server';
import { desc, eq } from 'drizzle-orm';
import { getDb, getSqlite } from '@/lib/database/client';
import { documents, notes } from '@/lib/database/schema';
import { getNoteTagMap, toDocumentDTO, toNoteListItemDTO } from '@/lib/database/serialize';
import type { DashboardDTO } from '@/types';

export const dynamic = 'force-dynamic';

interface DayRow {
  day: string;
  count: number;
}

function groupByDay(rows: DayRow[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const row of rows) map.set(row.day, row.count);
  return map;
}

function lastNDays(n: number): string[] {
  const days: string[] = [];
  const now = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
    days.push(
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`,
    );
  }
  return days;
}

export async function GET() {
  try {
    const db = getDb();
    const sqlite = getSqlite();
    const nowMs = Date.now();
    const dayStart = new Date();
    dayStart.setHours(0, 0, 0, 0);
    const fourteenDaysAgo = nowMs - 14 * 24 * 60 * 60 * 1000;

    const count = (table: string): number => {
      const row = sqlite
        .prepare(`SELECT COUNT(*) AS c FROM ${table}`)
        .get() as { c: number };
      return row.c;
    };

    const stats = {
      notes: count('notes'),
      pinned: (sqlite.prepare('SELECT COUNT(*) AS c FROM notes WHERE is_pinned = 1').get() as { c: number }).c,
      tags: count('tags'),
      documents: count('documents'),
      decks: count('flashcard_decks'),
      cards: count('flashcards'),
      dueToday: (
        sqlite
          .prepare('SELECT COUNT(*) AS c FROM flashcards WHERE due_at <= ?')
          .get(nowMs) as { c: number }
      ).c,
    };

    // Recent + pinned notes
    const recentNoteRows = db.select().from(notes).orderBy(desc(notes.updatedAt)).limit(6).all();
    const pinnedNoteRows = db
      .select()
      .from(notes)
      .where(eq(notes.isPinned, true))
      .orderBy(desc(notes.updatedAt))
      .limit(6)
      .all();

    const allIds = [...new Set([...recentNoteRows, ...pinnedNoteRows].map((n) => n.id))];
    const tagMap = getNoteTagMap(db, allIds);

    const recentDocuments = db
      .select()
      .from(documents)
      .orderBy(desc(documents.createdAt))
      .limit(5)
      .all();

    // 14-day activity buckets
    const noteActivity = groupByDay(
      sqlite
        .prepare(
          `SELECT strftime('%Y-%m-%d', updated_at / 1000, 'unixepoch') AS day, COUNT(*) AS count
           FROM notes WHERE updated_at >= ? GROUP BY day`,
        )
        .all(fourteenDaysAgo) as DayRow[],
    );
    const docActivity = groupByDay(
      sqlite
        .prepare(
          `SELECT strftime('%Y-%m-%d', created_at / 1000, 'unixepoch') AS day, COUNT(*) AS count
           FROM documents WHERE created_at >= ? GROUP BY day`,
        )
        .all(fourteenDaysAgo) as DayRow[],
    );
    const cardActivity = groupByDay(
      sqlite
        .prepare(
          `SELECT strftime('%Y-%m-%d', studied_at / 1000, 'unixepoch') AS day, COUNT(*) AS count
           FROM study_records WHERE studied_at >= ? GROUP BY day`,
        )
        .all(fourteenDaysAgo) as DayRow[],
    );

    const activity = lastNDays(14).map((date) => ({
      date,
      notes: noteActivity.get(date) ?? 0,
      documents: docActivity.get(date) ?? 0,
      cards: cardActivity.get(date) ?? 0,
    }));

    // Derived recent activity: latest note updates, document imports, card reviews
    const recentNoteEvents = recentNoteRows.slice(0, 5).map((n) => ({
      type: 'note' as const,
      label: n.title || 'Untitled note',
      at: n.updatedAt,
    }));
    const recentDocEvents = recentDocuments.slice(0, 4).map((d) => ({
      type: 'document' as const,
      label: d.title,
      at: d.createdAt,
    }));
    const recentStudyEvents = (
      sqlite
        .prepare(
          `SELECT f.question AS question, s.studied_at AS studied_at
           FROM study_records s JOIN flashcards f ON f.id = s.card_id
           ORDER BY s.studied_at DESC LIMIT 4`,
        )
        .all() as { question: string; studied_at: number }[]
    ).map((r) => ({
      type: 'study' as const,
      label: `Reviewed “${r.question.slice(0, 60)}${r.question.length > 60 ? '…' : ''}”`,
      at: new Date(r.studied_at),
    }));

    const recentActivity = [...recentNoteEvents, ...recentDocEvents, ...recentStudyEvents]
      .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
      .slice(0, 8)
      .map((e) => ({ type: e.type, label: e.label, at: new Date(e.at).toISOString() }));

    const response: DashboardDTO = {
      stats,
      recentNotes: recentNoteRows.map((n) => toNoteListItemDTO(db, n, tagMap)),
      pinnedNotes: pinnedNoteRows.map((n) => toNoteListItemDTO(db, n, tagMap)),
      recentDocuments: recentDocuments.map((d) => toDocumentDTO(db, d)),
      activity,
      recentActivity,
    };
    return NextResponse.json(response);
  } catch (err) {
    console.error('GET /api/dashboard failed:', err instanceof Error ? err.message : err);
    return NextResponse.json(
      { error: 'Failed to load dashboard' },
      { status: 500 },
    );
  }
}
