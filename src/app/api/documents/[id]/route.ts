import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { getDb } from '@/lib/database/client';
import { documents } from '@/lib/database/schema';
import { resolveTagIds, setDocumentTags } from '@/lib/database/tags';
import { toDocumentDTO } from '@/lib/database/serialize';
import { apiError, parseJson } from '@/lib/api/http';
import { z } from 'zod';
import { removeStoredFile } from '@/lib/storage/files';

export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ id: string }> };

const patchSchema = z.object({
  title: z.string().trim().min(1).max(300).optional(),
  tags: z.array(z.string().trim().min(1).max(40)).max(30).optional(),
});

export async function GET(_req: Request, { params }: Params) {
  try {
    const { id } = await params;
    const db = getDb();
    const row = db.select().from(documents).where(eq(documents.id, id)).get();
    if (!row) return apiError('Document not found', 404);
    return NextResponse.json(toDocumentDTO(db, row));
  } catch (err) {
    console.error('GET /api/documents/[id] failed:', err instanceof Error ? err.message : err);
    return apiError('Failed to load document', 500);
  }
}

export async function PATCH(req: Request, { params }: Params) {
  try {
    const { id } = await params;
    const [body, err] = await parseJson(req, patchSchema);
    if (err) return err;
    if (!body) return apiError('Invalid request body', 400);

    const db = getDb();
    const existing = db.select().from(documents).where(eq(documents.id, id)).get();
    if (!existing) return apiError('Document not found', 404);

    if (body.title !== undefined) {
      db.update(documents)
        .set({ title: body.title, updatedAt: new Date() })
        .where(eq(documents.id, id))
        .run();
    }
    if (body.tags !== undefined) {
      setDocumentTags(db, id, resolveTagIds(db, body.tags));
    }

    const row = db.select().from(documents).where(eq(documents.id, id)).get();
    if (!row) return apiError('Document not found', 404);
    return NextResponse.json(toDocumentDTO(db, row));
  } catch (err) {
    console.error('PATCH /api/documents/[id] failed:', err instanceof Error ? err.message : err);
    return apiError('Failed to update document', 500);
  }
}

export async function DELETE(_req: Request, { params }: Params) {
  try {
    const { id } = await params;
    const db = getDb();
    const existing = db.select().from(documents).where(eq(documents.id, id)).get();
    if (!existing) return apiError('Document not found', 404);

    db.delete(documents).where(eq(documents.id, id)).run();
    removeStoredFile(existing.storageName);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('DELETE /api/documents/[id] failed:', err instanceof Error ? err.message : err);
    return apiError('Failed to delete document', 500);
  }
}
