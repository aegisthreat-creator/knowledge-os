import { NextResponse } from 'next/server';
import { checkOllama } from '@/lib/ai/client';
import { getSetting, SETTING_KEYS } from '@/lib/database/settings';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const status = await checkOllama();
    const defaultModel = getSetting<string | null>(SETTING_KEYS.defaultModel, null);
    return NextResponse.json({
      connected: status.ok,
      baseUrl: status.baseUrl,
      models: status.models,
      defaultModel,
      error: status.error ?? null,
      hint: status.hint ?? null,
    });
  } catch (err) {
    console.error('GET /api/ai/status failed:', err instanceof Error ? err.message : err);
    return NextResponse.json(
      { connected: false, baseUrl: '', models: [], defaultModel: null, error: 'Status check failed', hint: null },
      { status: 500 },
    );
  }
}
