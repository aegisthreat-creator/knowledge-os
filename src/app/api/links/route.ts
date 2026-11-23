import { NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { getDb } from '@/lib/database/client';
import { noteLinks, notes } from '@/lib/database/schema';
import { apiError, parseJson } from '@/lib/api/http';
import { linkNoteSchema } from '@/lib/validation/schemas';
import { newId } from '@/lib/utils/id';

export const dynamic = 'force-dynamic';

/** Create a manual link between two notes. */
export async function POST(req: Request) {
  try {
    const [body, err] = await parseJson(req, linkNoteSchema);
    if (err) return err;
    if (!body) return apiError('Invalid request body', 400);
    if (body.sourceNoteId === body.targetNoteId) {
      return apiError('A note cannot link to itself', 400);
    }

    const db = getDb();
    const source = db.select({ id: notes.id }).from(notes).where(eq(notes.id, body.sourceNoteId)).get();
    const target = db.select({ id: notes.id }).from(notes).where(eq(notes.id, body.targetNoteId)).get();
    if (!source || !target) return apiError('Note not found', 404);

    const existing = db
      .select({ id: noteLinks.id })
      .from(noteLinks)
      .where(
        and(
          eq(noteLinks.sourceNoteId, body.sourceNoteId),
          eq(noteLinks.targetNoteId, body.targetNoteId),
        ),
      )
      .get();
    if (existing) return NextResponse.json({ id: existing.id, existing: true }, { status: 200 });

    const id = newId();
    db.insert(noteLinks)
      .values({
        id,
        sourceNoteId: body.sourceNoteId,
        targetNoteId: body.targetNoteId,
        createdAt: new Date(),
      })
      .run();
    return NextResponse.json({ id, existing: false }, { status: 201 });
  } catch (err) {
    console.error('POST /api/links failed:', err instanceof Error ? err.message : err);
    return apiError('Failed to create link', 500);
  }
}

/** Remove a link by id, or by source/target query params. */
export async function DELETE(req: Request) {
  try {
    const url = new URL(req.url);
    const id = url.searchParams.get('id');
    const source = url.searchParams.get('source');
    const target = url.searchParams.get('target');

    const db = getDb();
    if (id) {
      const existing = db.select({ id: noteLinks.id }).from(noteLinks).where(eq(noteLinks.id, id)).get();
      if (!existing) return apiError('Link not found', 404);
      db.delete(noteLinks).where(eq(noteLinks.id, id)).run();
      return NextResponse.json({ ok: true });
    }
    if (source && target) {
      db.delete(noteLinks)
        .where(
          and(
            eq(noteLinks.sourceNoteId, source),
            eq(noteLinks.targetNoteId, target),
          ),
        )
        .run();
      return NextResponse.json({ ok: true });
    }
    return apiError('Provide id or source+target', 400);
  } catch (err) {
    console.error('DELETE /api/links failed:', err instanceof Error ? err.message : err);
    return apiError('Failed to remove link', 500);
  }
}
