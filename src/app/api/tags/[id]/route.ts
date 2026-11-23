import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { getDb } from '@/lib/database/client';
import { tags } from '@/lib/database/schema';
import { apiError, parseJson } from '@/lib/api/http';
import { updateTagSchema } from '@/lib/validation/schemas';
import { toTagDTO } from '@/lib/database/serialize';

export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, { params }: Params) {
  try {
    const { id } = await params;
    const [body, err] = await parseJson(req, updateTagSchema);
    if (err) return err;
    if (!body) return apiError('Invalid request body', 400);

    const db = getDb();
    const existing = db.select().from(tags).where(eq(tags.id, id)).get();
    if (!existing) return apiError('Tag not found', 404);

    const updates: Partial<typeof tags.$inferInsert> = {};
    if (body.name !== undefined) updates.name = body.name;
    if (body.color !== undefined) updates.color = body.color;
    if (Object.keys(updates).length === 0) return NextResponse.json(toTagDTO(existing));

    db.update(tags).set(updates).where(eq(tags.id, id)).run();
    const updated = db.select().from(tags).where(eq(tags.id, id)).get();
    return NextResponse.json(toTagDTO(updated ?? existing));
  } catch (err) {
    if (err instanceof Error && /UNIQUE/i.test(err.message)) {
      return apiError('A tag with that name already exists', 409);
    }
    console.error('PATCH /api/tags/[id] failed:', err instanceof Error ? err.message : err);
    return apiError('Failed to update tag', 500);
  }
}

export async function DELETE(_req: Request, { params }: Params) {
  try {
    const { id } = await params;
    const db = getDb();
    const existing = db.select().from(tags).where(eq(tags.id, id)).get();
    if (!existing) return apiError('Tag not found', 404);
    db.delete(tags).where(eq(tags.id, id)).run();
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('DELETE /api/tags/[id] failed:', err instanceof Error ? err.message : err);
    return apiError('Failed to delete tag', 500);
  }
}
