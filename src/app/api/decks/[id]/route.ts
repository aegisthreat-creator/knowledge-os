import { NextResponse } from 'next/server';
import { desc, eq, sql } from 'drizzle-orm';
import { getDb } from '@/lib/database/client';
import { flashcardDecks, flashcards } from '@/lib/database/schema';
import { apiError, parseJson } from '@/lib/api/http';
import { updateDeckSchema } from '@/lib/validation/schemas';
import type { DeckDTO, FlashcardDTO } from '@/types';

export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ id: string }> };

function toCardDTO(card: typeof flashcards.$inferSelect): FlashcardDTO {
  return {
    id: card.id,
    deckId: card.deckId,
    question: card.question,
    answer: card.answer,
    box: card.box,
    dueAt: card.dueAt.toISOString(),
    studies: card.studies,
    correctStudies: card.correctStudies,
    lastStudiedAt: card.lastStudiedAt ? card.lastStudiedAt.toISOString() : null,
    sourceNoteId: card.sourceNoteId,
    createdAt: card.createdAt.toISOString(),
    updatedAt: card.updatedAt.toISOString(),
  };
}

export async function GET(_req: Request, { params }: Params) {
  try {
    const { id } = await params;
    const db = getDb();
    const nowMs = Date.now();

    const deck = db.select().from(flashcardDecks).where(eq(flashcardDecks.id, id)).get();
    if (!deck) return apiError('Deck not found', 404);

    const cardRows = db
      .select()
      .from(flashcards)
      .where(eq(flashcards.deckId, id))
      .orderBy(desc(flashcards.createdAt))
      .all();

    const counts = db
      .select({
        cardCount: sql<number>`COUNT(*)`,
        dueCount: sql<number>`SUM(CASE WHEN due_at <= ${nowMs} THEN 1 ELSE 0 END)`,
        newCount: sql<number>`SUM(CASE WHEN studies = 0 THEN 1 ELSE 0 END)`,
        learnedCount: sql<number>`SUM(CASE WHEN box >= 3 THEN 1 ELSE 0 END)`,
      })
      .from(flashcards)
      .where(eq(flashcards.deckId, id))
      .get();

    const dto: DeckDTO = {
      id: deck.id,
      name: deck.name,
      description: deck.description,
      sourceNoteId: deck.sourceNoteId,
      createdAt: deck.createdAt.toISOString(),
      updatedAt: deck.updatedAt.toISOString(),
      cardCount: counts?.cardCount ?? 0,
      dueCount: counts?.dueCount ?? 0,
      newCount: counts?.newCount ?? 0,
      learnedCount: counts?.learnedCount ?? 0,
    };

    return NextResponse.json({ deck: dto, cards: cardRows.map(toCardDTO) });
  } catch (err) {
    console.error('GET /api/decks/[id] failed:', err instanceof Error ? err.message : err);
    return apiError('Failed to load deck', 500);
  }
}

export async function PATCH(req: Request, { params }: Params) {
  try {
    const { id } = await params;
    const [body, err] = await parseJson(req, updateDeckSchema);
    if (err) return err;
    if (!body) return apiError('Invalid request body', 400);

    const db = getDb();
    const existing = db.select().from(flashcardDecks).where(eq(flashcardDecks.id, id)).get();
    if (!existing) return apiError('Deck not found', 404);

    const updates: Partial<typeof flashcardDecks.$inferInsert> = { updatedAt: new Date() };
    if (body.name !== undefined) updates.name = body.name;
    if (body.description !== undefined) updates.description = body.description;
    if (body.sourceNoteId !== undefined) updates.sourceNoteId = body.sourceNoteId;
    db.update(flashcardDecks).set(updates).where(eq(flashcardDecks.id, id)).run();

    const updated = db.select().from(flashcardDecks).where(eq(flashcardDecks.id, id)).get();
    if (!updated) return apiError('Deck not found', 404);
    return NextResponse.json({
      id: updated.id,
      name: updated.name,
      description: updated.description,
      sourceNoteId: updated.sourceNoteId,
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
      cardCount: 0,
      dueCount: 0,
      newCount: 0,
      learnedCount: 0,
    } satisfies DeckDTO);
  } catch (err) {
    console.error('PATCH /api/decks/[id] failed:', err instanceof Error ? err.message : err);
    return apiError('Failed to update deck', 500);
  }
}

export async function DELETE(_req: Request, { params }: Params) {
  try {
    const { id } = await params;
    const db = getDb();
    const existing = db.select().from(flashcardDecks).where(eq(flashcardDecks.id, id)).get();
    if (!existing) return apiError('Deck not found', 404);
    db.delete(flashcardDecks).where(eq(flashcardDecks.id, id)).run();
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('DELETE /api/decks/[id] failed:', err instanceof Error ? err.message : err);
    return apiError('Failed to delete deck', 500);
  }
}
