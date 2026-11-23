import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { chatComplete, checkOllama } from '@/lib/ai/client';
import { buildNoteActionMessages, parseFlashcards } from '@/lib/ai/actions';
import { resolveOllamaBaseUrl } from '@/lib/ai/config';
import { getDb } from '@/lib/database/client';
import { flashcardDecks, flashcards, notes } from '@/lib/database/schema';
import { getSetting, SETTING_KEYS } from '@/lib/database/settings';
import { apiError, parseJson } from '@/lib/api/http';
import { generateCardsSchema } from '@/lib/validation/schemas';
import { newId } from '@/lib/utils/id';
import type { FlashcardDTO } from '@/types';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

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

async function resolveModel(explicit?: string): Promise<string | null> {
  if (explicit) return explicit;
  const saved = getSetting<string | null>(SETTING_KEYS.defaultModel, null);
  if (saved) return saved;
  const status = await checkOllama();
  if (!status.ok) return null;
  return status.models[0]?.name ?? null;
}

/** Generate flashcards from a note with the local model and add them to the deck. */
export async function POST(req: Request, { params }: Params) {
  try {
    const { id } = await params;
    const [body, err] = await parseJson(req, generateCardsSchema);
    if (err) return err;
    if (!body) return apiError('Invalid request body', 400);

    const db = getDb();
    const deck = db.select().from(flashcardDecks).where(eq(flashcardDecks.id, id)).get();
    if (!deck) return apiError('Deck not found', 404);

    const note = db.select().from(notes).where(eq(notes.id, body.noteId)).get();
    if (!note) return apiError('Note not found', 404);
    if (!note.content.trim()) {
      return apiError('This note is empty — add some content before generating cards.', 400);
    }

    const model = await resolveModel(body.model);
    if (!model) {
      const status = await checkOllama();
      return apiError(
        status.error ??
          `No Ollama model available. Run: ollama pull llama3.2`,
        502,
      );
    }

    const messages = buildNoteActionMessages(
      'flashcards',
      { title: note.title, content: note.content },
      body.count ?? 12,
    );
    const raw = await chatComplete({ model, messages, baseUrl: resolveOllamaBaseUrl() });
    const parsed = parseFlashcards(raw, body.count ?? 12);
    if (parsed.length === 0) {
      return apiError(
        'The model did not return valid flashcard JSON. Try again or pick another model in Settings.',
        502,
      );
    }

    const now = new Date();
    const created = db.transaction((tx) => {
      const out: (typeof flashcards.$inferSelect)[] = [];
      for (const card of parsed) {
        const cardId = newId();
        tx.insert(flashcards)
          .values({
            id: cardId,
            deckId: id,
            question: card.question,
            answer: card.answer,
            box: 0,
            dueAt: now,
            sourceNoteId: note.id,
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

    return NextResponse.json({ model, cards: created.map(toCardDTO) }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Card generation failed';
    console.error('POST /api/decks/[id]/generate failed:', message);
    return apiError(message, 502);
  }
}
