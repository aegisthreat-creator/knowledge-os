import { NextResponse } from 'next/server';
import { eq, sql } from 'drizzle-orm';
import { getDb } from '@/lib/database/client';
import { collections, notes } from '@/lib/database/schema';
import { apiError, parseJson } from '@/lib/api/http';
import { updateCollectionSchema } from '@/lib/validation/schemas';
import { toCollectionDTO } from '@/lib/database/serialize';

export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, { params }: Params) {
  try {
    const { id } = await params;
    const [body, err] = await parseJson(req, updateCollectionSchema);
    if (err) return err;
    if (!body) return apiError('Invalid request body', 400);

    const db = getDb();
    const existing = db.select().from(collections).where(eq(collections.id, id)).get();
    if (!existing) return apiError('Collection not found', 404);

    const updates: Partial<typeof collections.$inferInsert> = {};
    if (body.name !== undefined) updates.name = body.name;
    if (body.description !== undefined) updates.description = body.description;
    if (body.color !== undefined) updates.color = body.color;
    if (Object.keys(updates).length > 0) {
      db.update(collections).set(updates).where(eq(collections.id, id)).run();
    }
    const updated = db.select().from(collections).where(eq(collections.id, id)).get();
    const count = db
      .select({ c: sql<number>`COUNT(*)` })
      .from(notes)
      .where(eq(notes.collectionId, id))
      .get();
    return NextResponse.json(toCollectionDTO(updated ?? existing, count?.c ?? 0));
  } catch (err) {
    console.error('PATCH /api/collections/[id] failed:', err instanceof Error ? err.message : err);
    return apiError('Failed to update collection', 500);
  }
}

export async function DELETE(_req: Request, { params }: Params) {
  try {
    const { id } = await params;
    const db = getDb();
    const existing = db.select().from(collections).where(eq(collections.id, id)).get();
    if (!existing) return apiError('Collection not found', 404);
    db.delete(collections).where(eq(collections.id, id)).run();
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('DELETE /api/collections/[id] failed:', err instanceof Error ? err.message : err);
    return apiError('Failed to delete collection', 500);
  }
}
