import { desc, eq } from 'drizzle-orm';
import { friendlyHttpError, type ChatMessage } from '@/lib/ai/client';
import { ASSISTANT_SYSTEM_PROMPT } from '@/lib/ai/actions';
import { resolveOllamaBaseUrl } from '@/lib/ai/config';
import { getDb } from '@/lib/database/client';
import { aiConversations, aiMessages } from '@/lib/database/schema';
import { apiError, parseJson } from '@/lib/api/http';
import { chatSchema } from '@/lib/validation/schemas';
import { newId } from '@/lib/utils/id';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

/**
 * Streaming chat endpoint.
 *
 * Response is NDJSON, one event per line:
 *   {"type":"token","token":"..."}
 *   {"type":"done","conversationId":"...","title":"..."}
 *   {"type":"error","message":"..."}
 *
 * Connection/model errors that occur before any token is produced are
 * returned as plain JSON error responses (status 502) instead.
 */
export async function POST(req: Request) {
  const [body, parseErr] = await parseJson(req, chatSchema);
  if (parseErr) return parseErr;
  if (!body) return apiError('Invalid request body', 400);

  const db = getDb();
  const model = body.model;

  try {
    // Resolve or create the conversation
    let conversationId: string;
    let title: string;
    let history: ChatMessage[] = [];

    if (body.conversationId) {
      const existing = db
        .select()
        .from(aiConversations)
        .where(eq(aiConversations.id, body.conversationId))
        .get();
      if (!existing) return apiError('Conversation not found', 404);
      conversationId = existing.id;
      title = existing.title;
      const messages = db
        .select()
        .from(aiMessages)
        .where(eq(aiMessages.conversationId, conversationId))
        .orderBy(desc(aiMessages.createdAt))
        .limit(30)
        .all()
        .reverse();
      history = messages.map((m) => ({ role: m.role, content: m.content }));
    } else {
      conversationId = newId();
      title = body.message.length > 60 ? `${body.message.slice(0, 60).trimEnd()}…` : body.message;
      db.insert(aiConversations)
        .values({
          id: conversationId,
          title,
          model,
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .run();
    }

    // Persist the user message
    db.insert(aiMessages)
      .values({
        id: newId(),
        conversationId,
        role: 'user',
        content: body.message,
        createdAt: new Date(),
      })
      .run();

    const messages: ChatMessage[] = [
      { role: 'system', content: ASSISTANT_SYSTEM_PROMPT },
      ...history,
      { role: 'user', content: body.message },
    ];

    // Start the upstream Ollama request first so connection errors surface
    // as clean JSON errors instead of a broken stream. The abort signal is
    // only armed while waiting for response headers — it must not fire during
    // (potentially long) streaming.
    const baseUrl = resolveOllamaBaseUrl();
    let upstream: Response;
    const connectController = new AbortController();
    const connectTimer = setTimeout(() => connectController.abort(), 15_000);
    try {
      upstream = await fetch(`${baseUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model, messages, stream: true }),
        signal: connectController.signal,
      });
    } catch (err) {
      const aborted = err instanceof Error && err.name === 'AbortError';
      return apiError(
        aborted
          ? `Timed out connecting to Ollama at ${baseUrl}.`
          : `Can't reach Ollama at ${baseUrl}. Start it with \`ollama serve\`.`,
        502,
      );
    } finally {
      clearTimeout(connectTimer);
    }
    if (!upstream.ok) {
      const text = await upstream.text().catch(() => '');
      return apiError(friendlyHttpError(upstream.status, text, model), 502);
    }
    if (!upstream.body) {
      return apiError('Ollama returned an empty response body.', 502);
    }

    const encoder = new TextEncoder();
    const decoder = new TextDecoder();
    const upstreamReader = upstream.body.getReader();

    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        let fullText = '';
        let buffer = '';
        let finished = false;

        const send = (obj: unknown) => {
          try {
            controller.enqueue(encoder.encode(`${JSON.stringify(obj)}\n`));
          } catch {
            // Client disconnected — cleanup happens in cancel().
          }
        };

        const saveAssistantMessage = () => {
          if (!fullText.trim()) return;
          try {
            db.insert(aiMessages)
              .values({
                id: newId(),
                conversationId,
                role: 'assistant',
                content: fullText,
                createdAt: new Date(),
              })
              .run();
            db.update(aiConversations)
              .set({ updatedAt: new Date(), model })
              .where(eq(aiConversations.id, conversationId))
              .run();
          } catch {
            // Never fail the stream because persistence failed.
          }
        };

        try {
          for (;;) {
            const { done, value } = await upstreamReader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() ?? '';
            for (const line of lines) {
              const trimmed = line.trim();
              if (!trimmed) continue;
              let parsed: { message?: { content?: string }; error?: string };
              try {
                parsed = JSON.parse(trimmed);
              } catch {
                continue;
              }
              if (parsed.error) {
                send({ type: 'error', message: parsed.error });
                finished = true;
                controller.close();
                return;
              }
              const token = parsed.message?.content;
              if (token) {
                fullText += token;
                send({ type: 'token', token });
              }
            }
          }
          saveAssistantMessage();
          finished = true;
          send({ type: 'done', conversationId, title });
          controller.close();
        } catch (err) {
          if (!finished) {
            const message =
              err instanceof Error && err.name === 'AbortError'
                ? 'Generation stopped.'
                : err instanceof Error
                  ? err.message
                  : 'Stream failed.';
            saveAssistantMessage();
            send({ type: 'error', message });
            try {
              controller.close();
            } catch {
              // already closed
            }
          }
        }
      },
      cancel() {
        try {
          void upstreamReader.cancel();
        } catch {
          // already cancelled
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'application/x-ndjson; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        'X-Accel-Buffering': 'no',
        'x-conversation-id': conversationId,
      },
    });
  } catch (err) {
    console.error('POST /api/ai/chat failed:', err instanceof Error ? err.message : err);
    return apiError('Chat request failed', 500);
  }
}
