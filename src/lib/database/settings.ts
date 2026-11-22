import { eq } from 'drizzle-orm';
import { getDb } from './client';
import { settings } from './schema';

/** Read a setting (JSON-encoded) with a fallback default. */
export function getSetting<T>(key: string, fallback: T): T {
  try {
    const row = getDb().select().from(settings).where(eq(settings.key, key)).get();
    if (!row) return fallback;
    return JSON.parse(row.value) as T;
  } catch {
    return fallback;
  }
}

/** Write a setting as JSON. */
export function setSetting(key: string, value: unknown): void {
  const db = getDb();
  db.insert(settings)
    .values({ key, value: JSON.stringify(value), updatedAt: new Date() })
    .onConflictDoUpdate({
      target: settings.key,
      set: { value: JSON.stringify(value), updatedAt: new Date() },
    })
    .run();
}

export function getAllSettings(): Record<string, unknown> {
  try {
    const rows = getDb().select().from(settings).all();
    const out: Record<string, unknown> = {};
    for (const row of rows) {
      try {
        out[row.key] = JSON.parse(row.value);
      } catch {
        out[row.key] = row.value;
      }
    }
    return out;
  } catch {
    return {};
  }
}

export const SETTING_KEYS = {
  ollamaBaseUrl: 'ai.ollamaBaseUrl',
  defaultModel: 'ai.defaultModel',
} as const;
