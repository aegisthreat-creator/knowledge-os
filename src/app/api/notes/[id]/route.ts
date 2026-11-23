import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { getDb } from '@/lib/database/client';
import { notes, noteLinks } from '@/lib/database/schema';
import { resolveTagIds, setNoteTags } from '@/lib/database/tags';
import { toNoteDTO } from '@/lib/database/serialize';
import { apiError, parseJson } from '@/lib/api/http';
import { updateNoteSchema } from '@/lib/validation/schemas';

export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Params) {
  try {
    const { id } = await params;
    const db = getDb();
    const note = db.select().from(notes).where(eq(notes.id, id)).get();
    if (!note) return apiError('Note not found', 404);

    const dto = toNoteDTO(db, note);

    const outgoing = db
      .select({
        id: noteLinks.id,
        targetNoteId: noteLinks.targetNoteId,
        targetTitle: notes.title,
      })
      .from(noteLinks)
      .leftJoin(notes, eq(noteLinks.targetNoteId, notes.id))
      .where(eq(noteLinks.sourceNoteId, id))
      .all();

    const incoming = db
      .select({
        id: noteLinks.id,
        sourceNoteId: noteLinks.sourceNoteId,
        sourceTitle: notes.title,
      })
      .from(noteLinks)
      .leftJoin(notes, eq(noteLinks.sourceNoteId, notes.id))
      .where(eq(noteLinks.targetNoteId, id))
      .all();

    dto.links = { outgoing, incoming };
    return NextResponse.json(dto);
  } catch (err) {
    console.error('GET /api/notes/[id] failed:', err instanceof Error ? err.message : err);
    return apiError('Failed to load note', 500);
  }
}

export async function PATCH(req: Request, { params }: Params) {
  try {
    const { id } = await params;
    const [body, err] = await parseJson(req, updateNoteSchema);
    if (err) return err;
    if (!body) return apiError('Invalid request body', 400);

    const db = getDb();
    const existing = db.select().from(notes).where(eq(notes.id, id)).get();
    if (!existing) return apiError('Note not found', 404);

    const updates: Partial<typeof notes.$inferInsert> = { updatedAt: new Date() };
    if (body.title !== undefined) updates.title = body.title;
    if (body.content !== undefined) updates.content = body.content;
    if (body.collectionId !== undefined) updates.collectionId = body.collectionId;
    if (body.isPinned !== undefined) updates.isPinned = body.isPinned;
    if (body.isFavorite !== undefined) updates.isFavorite = body.isFavorite;

    db.update(notes).set(updates).where(eq(notes.id, id)).run();

    if (body.tags !== undefined) {
      const tagIds = resolveTagIds(db, body.tags);
      setNoteTags(db, id, tagIds);
    }

    const note = db.select().from(notes).where(eq(notes.id, id)).get();
    if (!note) return apiError('Note not found', 404);
    return NextResponse.json(toNoteDTO(db, note));
  } catch (err) {
    console.error('PATCH /api/notes/[id] failed:', err instanceof Error ? err.message : err);
    return apiError('Failed to update note', 500);
  }
}

export async function DELETE(_req: Request, { params }: Params) {
  try {
    const { id } = await params;
    const db = getDb();
    const existing = db.select().from(notes).where(eq(notes.id, id)).get();
    if (!existing) return apiError('Note not found', 404);
    db.delete(notes).where(eq(notes.id, id)).run();
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('DELETE /api/notes/[id] failed:', err instanceof Error ? err.message : err);
    return apiError('Failed to delete note', 500);
  }
}
