import { resolveOllamaBaseUrl } from './config';

/**
 * Ollama REST connector.
 *
 * All Ollama traffic in KnowledgeOS goes through this module — components and
 * routes never call Ollama directly. Nothing here logs message/note content.
 */

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface OllamaModel {
  name: string;
  size?: number;
  details?: {
    family?: string;
    parameter_size?: string;
    quantization_level?: string;
  };
  modifiedAt?: string;
}

export interface AiStatusResult {
  ok: boolean;
  baseUrl: string;
  models: OllamaModel[];
  error?: string;
  /** Actionable next step shown in the UI. */
  hint?: string;
}

const CONNECT_TIMEOUT_MS = 4_000;
const COMPLETE_TIMEOUT_MS = 120_000;
const STREAM_IDLE_TIMEOUT_MS = 90_000;

interface RawModel {
  name: string;
  model?: string;
  size?: number;
  details?: OllamaModel['details'];
  modified_at?: string;
}

export async function checkOllama(
  baseUrl: string = resolveOllamaBaseUrl(),
): Promise<AiStatusResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), CONNECT_TIMEOUT_MS);
  try {
    const res = await fetch(`${baseUrl}/api/tags`, {
      signal: controller.signal,
      cache: 'no-store',
    });
    if (!res.ok) {
      return {
        ok: false,
        baseUrl,
        models: [],
        error: `Ollama responded with HTTP ${res.status}.`,
        hint: 'Check that the URL in Settings points at your Ollama instance.',
      };
    }
    const data = (await res.json()) as { models?: RawModel[] };
    const models: OllamaModel[] = (data.models ?? []).map((m) => ({
      name: m.name ?? m.model ?? 'unknown',
      size: m.size,
      details: m.details,
      modifiedAt: m.modified_at,
    }));
    return { ok: true, baseUrl, models };
  } catch (err) {
    const aborted = err instanceof Error && err.name === 'AbortError';
    return {
      ok: false,
      baseUrl,
      models: [],
      error: aborted
        ? `Timed out connecting to Ollama at ${baseUrl}.`
        : `Can't reach Ollama at ${baseUrl}.`,
      hint: 'Make sure Ollama is installed and running: `ollama serve`, then `ollama pull llama3.2`.',
    };
  } finally {
    clearTimeout(timer);
  }
}

export function friendlyHttpError(status: number, bodyText: string, model: string): string {
  let message = '';
  try {
    const parsed = JSON.parse(bodyText) as { error?: string };
    message = parsed.error ?? '';
  } catch {
    message = bodyText.slice(0, 300);
  }
  if (/not found|no such model/i.test(message) || status === 404) {
    return `Model "${model}" isn't installed. Run: ollama pull ${model}`;
  }
  if (status === 401 || status === 403) {
    return `Ollama rejected the request (${status}). Check your Ollama configuration.`;
  }
  return message ? `Ollama error: ${message}` : `Ollama request failed (HTTP ${status}).`;
}

/**
 * Streaming chat via POST /api/chat (NDJSON). Invokes `onToken` for each
 * content chunk and resolves with the full assistant text.
 */
export async function streamChat(params: {
  model: string;
  messages: ChatMessage[];
  baseUrl?: string;
  signal?: AbortSignal;
  onToken: (token: string) => void;
}): Promise<string> {
  const { model, messages, signal, onToken } = params;
  const baseUrl = params.baseUrl ?? resolveOllamaBaseUrl();

  const controller = new AbortController();
  const onOuterAbort = () => controller.abort();
  signal?.addEventListener('abort', onOuterAbort, { once: true });

  let idleTimer: ReturnType<typeof setTimeout> | null = null;
  const armIdleTimer = () => {
    if (idleTimer) clearTimeout(idleTimer);
    idleTimer = setTimeout(() => controller.abort(), STREAM_IDLE_TIMEOUT_MS);
  };

  let fullText = '';
  try {
    armIdleTimer();
    const res = await fetch(`${baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, messages, stream: true }),
      signal: controller.signal,
    });

    if (!res.ok) {
      const bodyText = await res.text().catch(() => '');
      throw new Error(friendlyHttpError(res.status, bodyText, model));
    }
    if (!res.body) {
      throw new Error('Ollama returned an empty response body.');
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      armIdleTimer();
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        let parsed: { message?: { content?: string }; done?: boolean; error?: string };
        try {
          parsed = JSON.parse(trimmed);
        } catch {
          continue; // tolerate partial/unknown lines
        }
        if (parsed.error) {
          throw new Error(`Ollama error: ${parsed.error}`);
        }
        const token = parsed.message?.content;
        if (token) {
          fullText += token;
          onToken(token);
        }
      }
    }
    return fullText;
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      if (signal?.aborted) throw new Error('Generation stopped.');
      throw new Error('Ollama stopped responding (idle timeout).');
    }
    if (err instanceof TypeError) {
      // fetch network failure
      throw new Error(
        `Can't reach Ollama at ${baseUrl}. Start it with \`ollama serve\` or fix the URL in Settings.`,
      );
    }
    throw err;
  } finally {
    if (idleTimer) clearTimeout(idleTimer);
    signal?.removeEventListener('abort', onOuterAbort);
  }
}

/** Non-streaming completion (used for note actions and card generation). */
export async function chatComplete(params: {
  model: string;
  messages: ChatMessage[];
  baseUrl?: string;
  signal?: AbortSignal;
}): Promise<string> {
  const { model, messages, signal } = params;
  const baseUrl = params.baseUrl ?? resolveOllamaBaseUrl();

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), COMPLETE_TIMEOUT_MS);
  const onOuterAbort = () => controller.abort();
  signal?.addEventListener('abort', onOuterAbort, { once: true });

  try {
    const res = await fetch(`${baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, messages, stream: false }),
      signal: controller.signal,
    });
    if (!res.ok) {
      const bodyText = await res.text().catch(() => '');
      throw new Error(friendlyHttpError(res.status, bodyText, model));
    }
    const data = (await res.json()) as { message?: { content?: string }; error?: string };
    if (data.error) throw new Error(`Ollama error: ${data.error}`);
    const content = data.message?.content;
    if (typeof content !== 'string') {
      throw new Error('Ollama returned an unexpected response shape.');
    }
    return content;
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      if (signal?.aborted) throw err;
      throw new Error('The AI request timed out. The model may be large or busy — try again.');
    }
    if (err instanceof TypeError) {
      throw new Error(
        `Can't reach Ollama at ${baseUrl}. Start it with \`ollama serve\` or fix the URL in Settings.`,
      );
    }
    throw err;
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener('abort', onOuterAbort);
  }
}
