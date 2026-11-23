import { NextResponse } from 'next/server';
import { and, eq, sql } from 'drizzle-orm';
import { getDb } from '@/lib/database/client';
import { flashcardDecks, flashcards, studyRecords } from '@/lib/database/schema';
import { applyGrade } from '@/lib/flashcards/srs';
import { apiError, parseJson } from '@/lib/api/http';
import { studyResultSchema } from '@/lib/validation/schemas';
import { newId } from '@/lib/utils/id';

export const dynamic = 'force-dynamic';

/**
 * Persist a study session: applies the spaced-repetition schedule to each
 * card and appends one study record per grading.
 */
export async function POST(req: Request) {
  try {
    const [body, err] = await parseJson(req, studyResultSchema);
    if (err) return err;
    if (!body) return apiError('Invalid request body', 400);

    const db = getDb();
    const deck = db.select().from(flashcardDecks).where(eq(flashcardDecks.id, body.deckId)).get();
    if (!deck) return apiError('Deck not found', 404);

    let studied = 0;
    let correct = 0;

    db.transaction((tx) => {
      for (const result of body.results) {
        const card = tx
          .select()
          .from(flashcards)
          .where(
            and(eq(flashcards.id, result.cardId), eq(flashcards.deckId, body.deckId)),
          )
          .get();
        if (!card) continue;

        const now = new Date();
        const next = applyGrade(
          { box: card.box, studies: card.studies, correctStudies: card.correctStudies },
          result.grade,
          now,
        );

        tx.update(flashcards)
          .set({
            box: next.box,
            studies: next.studies,
            correctStudies: next.correctStudies,
            dueAt: next.dueAt,
            lastStudiedAt: now,
            updatedAt: now,
          })
          .where(eq(flashcards.id, card.id))
          .run();

        tx.insert(studyRecords)
          .values({
            id: newId(),
            deckId: body.deckId,
            cardId: card.id,
            grade: result.grade,
            studiedAt: now,
          })
          .run();

        studied += 1;
        if (result.grade === 'good' || result.grade === 'easy') correct += 1;
      }
      tx.update(flashcardDecks).set({ updatedAt: new Date() }).where(eq(flashcardDecks.id, body.deckId)).run();
    });

    const nowMs = Date.now();
    const counts = db
      .select({
        dueCount: sql<number>`SUM(CASE WHEN due_at <= ${nowMs} THEN 1 ELSE 0 END)`,
        learnedCount: sql<number>`SUM(CASE WHEN box >= 3 THEN 1 ELSE 0 END)`,
        cardCount: sql<number>`COUNT(*)`,
      })
      .from(flashcards)
      .where(eq(flashcards.deckId, body.deckId))
      .get();

    return NextResponse.json({
      studied,
      correct,
      progress: {
        cardCount: counts?.cardCount ?? 0,
        dueCount: counts?.dueCount ?? 0,
        learnedCount: counts?.learnedCount ?? 0,
      },
    });
  } catch (err) {
    console.error('POST /api/study failed:', err instanceof Error ? err.message : err);
    return apiError('Failed to record study session', 500);
  }
}
