import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { chatComplete, checkOllama, type ChatMessage } from '@/lib/ai/client';
import { buildNoteActionMessages, parseFlashcards } from '@/lib/ai/actions';
import { resolveOllamaBaseUrl } from '@/lib/ai/config';
import { getDb } from '@/lib/database/client';
import { notes } from '@/lib/database/schema';
import { getSetting, SETTING_KEYS } from '@/lib/database/settings';
import { apiError, parseJson } from '@/lib/api/http';
import { noteActionSchema } from '@/lib/validation/schemas';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

/** Resolve which model to use: explicit → saved default → first installed. */
async function resolveModel(explicit?: string): Promise<{ model: string } | { error: string }> {
  if (explicit) return { model: explicit };
  const saved = getSetting<string | null>(SETTING_KEYS.defaultModel, null);
  if (saved) return { model: saved };
  const status = await checkOllama();
  if (!status.ok) {
    return {
      error: status.error ?? `Can't reach Ollama at ${status.baseUrl}.`,
    };
  }
  const first = status.models[0];
  if (!first) {
    return {
      error: 'No Ollama models are installed. Run: ollama pull llama3.2',
    };
  }
  return { model: first.name };
}

/**
 * AI note actions — summarize, explain, key points, questions, flashcards,
 * improve writing, extract concepts. Runs against the local Ollama instance.
 */
export async function POST(req: Request) {
  let body: { noteId: string; action: string; model?: string; count?: number } | null = null;
  try {
    const [parsed, err] = await parseJson(req, noteActionSchema);
    if (err) return err;
    body = parsed;
  } catch {
    return apiError('Invalid request body', 400);
  }
  if (!body) return apiError('Invalid request body', 400);

  try {
    const db = getDb();
    const note = db.select().from(notes).where(eq(notes.id, body.noteId)).get();
    if (!note) return apiError('Note not found', 404);
    if (!note.content.trim()) {
      return apiError('This note is empty — add some content before running an AI action.', 400);
    }

    const resolved = await resolveModel(body.model);
    if ('error' in resolved) return apiError(resolved.error, 502);

    const messages: ChatMessage[] = buildNoteActionMessages(
      body.action,
      { title: note.title, content: note.content },
      body.count ?? 12,
    );

    const baseUrl = resolveOllamaBaseUrl();
    const raw = await chatComplete({ model: resolved.model, messages, baseUrl });

    if (body.action === 'flashcards') {
      const cards = parseFlashcards(raw, body.count ?? 12);
      if (cards.length === 0) {
        return apiError(
          'The model did not return valid flashcard JSON. Try again or use a different model.',
          502,
        );
      }
      return NextResponse.json({ action: body.action, model: resolved.model, cards });
    }

    return NextResponse.json({
      action: body.action,
      model: resolved.model,
      result: raw.trim(),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'AI action failed';
    console.error('POST /api/ai/actions failed:', message);
    return apiError(message, 502);
  }
}
