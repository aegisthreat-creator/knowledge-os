import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { getDb } from '@/lib/database/client';
import { flashcardDecks, flashcards } from '@/lib/database/schema';
import { apiError, parseJson } from '@/lib/api/http';
import { z } from 'zod';
import { newId } from '@/lib/utils/id';
import type { FlashcardDTO } from '@/types';

export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ id: string }> };

const addCardsSchema = z.object({
  cards: z
    .array(
      z.object({
        question: z.string().trim().min(1).max(5_000),
        answer: z.string().trim().min(1).max(10_000),
        sourceNoteId: z.string().max(64).nullable().optional(),
      }),
    )
    .min(1)
    .max(50),
});

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

/** Bulk-add cards to a deck (manual creation and AI generation share this). */
export async function POST(req: Request, { params }: Params) {
  try {
    const { id } = await params;
    const [body, err] = await parseJson(req, addCardsSchema);
    if (err) return err;
    if (!body) return apiError('Invalid request body', 400);

    const db = getDb();
    const deck = db.select().from(flashcardDecks).where(eq(flashcardDecks.id, id)).get();
    if (!deck) return apiError('Deck not found', 404);

    const now = new Date();
    const created = db.transaction((tx) => {
      const out: (typeof flashcards.$inferSelect)[] = [];
      for (const card of body.cards) {
        const cardId = newId();
        tx.insert(flashcards)
          .values({
            id: cardId,
            deckId: id,
            question: card.question,
            answer: card.answer,
            box: 0,
            dueAt: now,
            sourceNoteId: card.sourceNoteId ?? null,
            createdAt: now,
            updatedAt: now,
          })
          .run();
        const row = tx.select().from(flashcards).where(eq(flashcards.id, cardId)).get();
        if (row) out.push(row);
      }
      tx.update(flashcardDecks).set({ updatedAt: now }).where(eq(flashcardDecks.id, id)).run();
      return out;
    });

    return NextResponse.json(created.map(toCardDTO), { status: 201 });
  } catch (err) {
    console.error('POST /api/decks/[id]/cards failed:', err instanceof Error ? err.message : err);
    return apiError('Failed to add cards', 500);
  }
}
