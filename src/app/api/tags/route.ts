import { NextResponse } from 'next/server';
import { eq, sql } from 'drizzle-orm';
import { getDb } from '@/lib/database/client';
import { tags } from '@/lib/database/schema';
import { findOrCreateTag } from '@/lib/database/tags';
import { apiError, parseJson } from '@/lib/api/http';
import { createTagSchema } from '@/lib/validation/schemas';
import { toTagDTO } from '@/lib/database/serialize';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const db = getDb();
    const rows = db
      .select({
        id: tags.id,
        name: tags.name,
        color: tags.color,
        noteCount: sql<number>`(SELECT COUNT(*) FROM note_tags WHERE tag_id = ${tags}.id)`.as(
          'noteCount',
        ),
      })
      .from(tags)
      .orderBy(sql`noteCount DESC`, tags.name)
      .all();
    return NextResponse.json(
      rows.map((r) => ({ ...toTagDTO({ id: r.id, name: r.name, color: r.color, createdAt: new Date() }), noteCount: r.noteCount })),
    );
  } catch (err) {
    console.error('GET /api/tags failed:', err instanceof Error ? err.message : err);
    return apiError('Failed to load tags', 500);
  }
}

export async function POST(req: Request) {
  try {
    const [body, err] = await parseJson(req, createTagSchema);
    if (err) return err;
    if (!body) return apiError('Invalid request body', 400);

    const db = getDb();
    const tag = findOrCreateTag(db, body.name);
    if (body.color !== undefined && body.color !== tag.color) {
      db.update(tags).set({ color: body.color }).where(eq(tags.id, tag.id)).run();
    }
    const updated = db.select().from(tags).where(eq(tags.id, tag.id)).get();
    return NextResponse.json(toTagDTO(updated ?? tag), { status: 201 });
  } catch (err) {
    console.error('POST /api/tags failed:', err instanceof Error ? err.message : err);
    return apiError('Failed to create tag', 500);
  }
}
