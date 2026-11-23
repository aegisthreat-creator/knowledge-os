import { NextResponse } from 'next/server';
import { searchProvider } from '@/lib/search/search';
import { searchQuerySchema } from '@/lib/validation/schemas';
import { zodError } from '@/lib/api/http';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const parsed = searchQuerySchema.safeParse({
      q: url.searchParams.get('q') ?? '',
      scope: url.searchParams.get('scope') ?? undefined,
      limit: url.searchParams.get('limit') ?? undefined,
    });
    if (!parsed.success) return zodError(parsed.error);

    const { q, scope, limit } = parsed.data;
    const result = await searchProvider.search({ query: q, limit, scope });
    return NextResponse.json(result);
  } catch (err) {
    console.error('GET /api/search failed:', err instanceof Error ? err.message : err);
    return NextResponse.json({ error: 'Search failed' }, { status: 500 });
  }
}
