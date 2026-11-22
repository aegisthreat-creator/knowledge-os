import { NextResponse } from 'next/server';
import { desc, eq, sql } from 'drizzle-orm';
import { getDb } from '@/lib/database/client';
import { flashcardDecks } from '@/lib/database/schema';
import { apiError, parseJson } from '@/lib/api/http';
import { createDeckSchema } from '@/lib/validation/schemas';
import { newId } from '@/lib/utils/id';
import type { DeckDTO } from '@/types';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const db = getDb();
    const nowMs = Date.now();

    const rows = db
      .select({
        id: flashcardDecks.id,
        name: flashcardDecks.name,
        description: flashcardDecks.description,
        sourceNoteId: flashcardDecks.sourceNoteId,
        createdAt: flashcardDecks.createdAt,
        updatedAt: flashcardDecks.updatedAt,
        cardCount: sql<number>`(SELECT COUNT(*) FROM flashcards WHERE deck_id = ${flashcardDecks}.id)`,
        dueCount: sql<number>`(SELECT COUNT(*) FROM flashcards WHERE deck_id = ${flashcardDecks}.id AND due_at <= ${nowMs})`,
        newCount: sql<number>`(SELECT COUNT(*) FROM flashcards WHERE deck_id = ${flashcardDecks}.id AND studies = 0)`,
        learnedCount: sql<number>`(SELECT COUNT(*) FROM flashcards WHERE deck_id = ${flashcardDecks}.id AND box >= 3)`,
      })
      .from(flashcardDecks)
      .orderBy(desc(flashcardDecks.updatedAt))
      .all();

    const result: DeckDTO[] = rows.map((r) => ({
      id: r.id,
      name: r.name,
      description: r.description,
      sourceNoteId: r.sourceNoteId,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
      cardCount: r.cardCount,
      dueCount: r.dueCount,
      newCount: r.newCount,
      learnedCount: r.learnedCount,
    }));
    return NextResponse.json(result);
  } catch (err) {
    console.error('GET /api/decks failed:', err instanceof Error ? err.message : err);
    return apiError('Failed to load decks', 500);
  }
}

export async function POST(req: Request) {
  try {
    const [body, err] = await parseJson(req, createDeckSchema);
    if (err) return err;
    if (!body) return apiError('Invalid request body', 400);

    const db = getDb();
    const id = newId();
    const now = new Date();
    db.insert(flashcardDecks)
      .values({
        id,
        name: body.name,
        description: body.description ?? null,
        sourceNoteId: body.sourceNoteId ?? null,
        createdAt: now,
        updatedAt: now,
      })
      .run();

    const created = db.select().from(flashcardDecks).where(eq(flashcardDecks.id, id)).get();
    if (!created) return apiError('Failed to create deck', 500);

    const dto: DeckDTO = {
      id: created.id,
      name: created.name,
      description: created.description,
      sourceNoteId: created.sourceNoteId,
      createdAt: created.createdAt.toISOString(),
      updatedAt: created.updatedAt.toISOString(),
      cardCount: 0,
      dueCount: 0,
      newCount: 0,
      learnedCount: 0,
    };
    return NextResponse.json(dto, { status: 201 });
  } catch (err) {
    console.error('POST /api/decks failed:', err instanceof Error ? err.message : err);
    return apiError('Failed to create deck', 500);
  }
}
