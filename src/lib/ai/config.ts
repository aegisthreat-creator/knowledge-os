import { getSetting, SETTING_KEYS } from '@/lib/database/settings';

export const DEFAULT_OLLAMA_BASE_URL = 'http://127.0.0.1:11434';

function normalizeUrl(url: string): string | null {
  const trimmed = url.trim().replace(/\/+$/, '');
  if (!/^https?:\/\/[^\s]+$/i.test(trimmed)) return null;
  return trimmed;
}

/**
 * Resolve the Ollama base URL: saved setting → env var → local default.
 * Only http(s) URLs are accepted (never file: or arbitrary schemes).
 */
export function resolveOllamaBaseUrl(): string {
  const saved = getSetting<string | null>(SETTING_KEYS.ollamaBaseUrl, null);
  if (typeof saved === 'string') {
    const normalized = normalizeUrl(saved);
    if (normalized) return normalized;
  }
  const env = process.env.OLLAMA_BASE_URL;
  if (env) {
    const normalized = normalizeUrl(env);
    if (normalized) return normalized;
  }
  return DEFAULT_OLLAMA_BASE_URL;
}
