import { NextResponse } from 'next/server';
import { getAllSettings, getSetting, setSetting, SETTING_KEYS } from '@/lib/database/settings';
import { DEFAULT_OLLAMA_BASE_URL } from '@/lib/ai/config';
import { apiError, parseJson } from '@/lib/api/http';
import { updateSettingsSchema } from '@/lib/validation/schemas';
import { getDatabasePath } from '@/lib/database/client';

export const dynamic = 'force-dynamic';

const PUBLIC_KEYS = [SETTING_KEYS.ollamaBaseUrl, SETTING_KEYS.defaultModel];

export async function GET() {
  try {
    const all = getAllSettings();
    const publicSettings: Record<string, unknown> = {};
    for (const key of PUBLIC_KEYS) {
      if (key in all) publicSettings[key] = all[key];
    }
    return NextResponse.json({
      settings: publicSettings,
      defaults: {
        ollamaBaseUrl: DEFAULT_OLLAMA_BASE_URL,
        databasePath: getDatabasePath(),
      },
      env: {
        ollamaBaseUrl: process.env.OLLAMA_BASE_URL ?? null,
      },
    });
  } catch (err) {
    console.error('GET /api/settings failed:', err instanceof Error ? err.message : err);
    return apiError('Failed to load settings', 500);
  }
}

export async function PUT(req: Request) {
  try {
    const [body, err] = await parseJson(req, updateSettingsSchema);
    if (err) return err;
    if (!body) return apiError('Invalid request body', 400);

    if (body.ollamaBaseUrl !== undefined) {
      const trimmed = body.ollamaBaseUrl.trim().replace(/\/+$/, '');
      setSetting(SETTING_KEYS.ollamaBaseUrl, trimmed === '' ? null : trimmed);
    }
    if (body.defaultModel !== undefined) {
      setSetting(SETTING_KEYS.defaultModel, body.defaultModel || null);
    }

    const baseUrl = getSetting<string | null>(SETTING_KEYS.ollamaBaseUrl, null);
    const defaultModel = getSetting<string | null>(SETTING_KEYS.defaultModel, null);
    return NextResponse.json({
      settings: {
        [SETTING_KEYS.ollamaBaseUrl]: baseUrl,
        [SETTING_KEYS.defaultModel]: defaultModel,
      },
    });
  } catch (err) {
    console.error('PUT /api/settings failed:', err instanceof Error ? err.message : err);
    return apiError('Failed to save settings', 500);
  }
}
