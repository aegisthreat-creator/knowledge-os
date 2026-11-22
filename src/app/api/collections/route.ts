import { NextResponse } from 'next/server';
import { asc, eq, sql } from 'drizzle-orm';
import { getDb } from '@/lib/database/client';
import { collections } from '@/lib/database/schema';
import { apiError, parseJson } from '@/lib/api/http';
import { createCollectionSchema } from '@/lib/validation/schemas';
import { toCollectionDTO } from '@/lib/database/serialize';
import { newId } from '@/lib/utils/id';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const db = getDb();
    const rows = db
      .select({
        id: collections.id,
        name: collections.name,
        description: collections.description,
        color: collections.color,
        createdAt: collections.createdAt,
        noteCount: sql<number>`(SELECT COUNT(*) FROM notes WHERE collection_id = ${collections}.id)`,
      })
      .from(collections)
      .orderBy(asc(sql`${collections.name} COLLATE NOCASE`))
      .all();
    return NextResponse.json(rows.map((r) => toCollectionDTO(r, r.noteCount)));
  } catch (err) {
    console.error('GET /api/collections failed:', err instanceof Error ? err.message : err);
    return apiError('Failed to load collections', 500);
  }
}

export async function POST(req: Request) {
  try {
    const [body, err] = await parseJson(req, createCollectionSchema);
    if (err) return err;
    if (!body) return apiError('Invalid request body', 400);

    const db = getDb();
    const id = newId();
    db.insert(collections)
      .values({
        id,
        name: body.name,
        description: body.description ?? null,
        color: body.color ?? null,
        createdAt: new Date(),
      })
      .run();
    const created = db.select().from(collections).where(eq(collections.id, id)).get();
    if (!created) return apiError('Failed to create collection', 500);
    return NextResponse.json(toCollectionDTO(created, 0), { status: 201 });
  } catch (err) {
    console.error('POST /api/collections failed:', err instanceof Error ? err.message : err);
    return apiError('Failed to create collection', 500);
  }
}
