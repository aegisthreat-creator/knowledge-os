import { NextResponse } from 'next/server';
import { and, asc, desc, eq, inArray, sql } from 'drizzle-orm';
import { z } from 'zod';
import { getDb } from '@/lib/database/client';
import { noteTags, notes, tags } from '@/lib/database/schema';
import { resolveTagIds, setNoteTags } from '@/lib/database/tags';
import { getNoteTagMap, toNoteDTO, toNoteListItemDTO } from '@/lib/database/serialize';
import { apiError, parseJson, zodError } from '@/lib/api/http';
import { createNoteSchema } from '@/lib/validation/schemas';
import { newId } from '@/lib/utils/id';

export const dynamic = 'force-dynamic';

const listQuerySchema = z.object({
  sort: z.enum(['updated', 'created', 'title']).optional().default('updated'),
  collection: z.string().max(64).optional(),
  tag: z.string().max(40).optional(),
  pinned: z.enum(['true', 'false']).optional(),
  favorite: z.enum(['true', 'false']).optional(),
  limit: z.coerce.number().int().min(1).max(500).optional().default(200),
});

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const parsed = listQuerySchema.safeParse({
      sort: url.searchParams.get('sort') ?? undefined,
      collection: url.searchParams.get('collection') ?? undefined,
      tag: url.searchParams.get('tag') ?? undefined,
      pinned: url.searchParams.get('pinned') ?? undefined,
      favorite: url.searchParams.get('favorite') ?? undefined,
      limit: url.searchParams.get('limit') ?? undefined,
    });
    if (!parsed.success) return zodError(parsed.error);

    const { sort, collection, tag, pinned, favorite, limit } = parsed.data;
    const db = getDb();

    const conditions = [];
    if (collection) conditions.push(eq(notes.collectionId, collection));
    if (pinned === 'true') conditions.push(eq(notes.isPinned, true));
    if (favorite === 'true') conditions.push(eq(notes.isFavorite, true));
    if (tag) {
      const matchingTag = db
        .select({ id: tags.id })
        .from(tags)
        .where(eq(tags.name, tag.trim().toLowerCase()))
        .get();
      const noteIds = matchingTag
        ? db
            .select({ noteId: noteTags.noteId })
            .from(noteTags)
            .where(eq(noteTags.tagId, matchingTag.id))
            .all()
            .map((r) => r.noteId)
        : [];
      if (noteIds.length === 0) return NextResponse.json([]);
      conditions.push(inArray(notes.id, noteIds));
    }

    const order =
      sort === 'title'
        ? asc(sql`${notes.title} COLLATE NOCASE`)
        : sort === 'created'
          ? desc(notes.createdAt)
          : desc(notes.updatedAt);

    const rows = db
      .select()
      .from(notes)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(notes.isPinned), order)
      .limit(limit)
      .all();

    const tagMap = getNoteTagMap(
      db,
      rows.map((r) => r.id),
    );
    return NextResponse.json(rows.map((row) => toNoteListItemDTO(db, row, tagMap)));
  } catch (err) {
    console.error('GET /api/notes failed:', err instanceof Error ? err.message : err);
    return apiError('Failed to load notes', 500);
  }
}

export async function POST(req: Request) {
  try {
    const [body, err] = await parseJson(req, createNoteSchema);
    if (err) return err;
    if (!body) return apiError('Invalid request body', 400);

    const db = getDb();
    const now = new Date();
    const id = newId();
    const tagIds = body.tags ? resolveTagIds(db, body.tags) : [];

    db.insert(notes)
      .values({
        id,
        title: body.title ?? '',
        content: body.content ?? '',
        collectionId: body.collectionId ?? null,
        isPinned: body.isPinned ?? false,
        isFavorite: body.isFavorite ?? false,
        createdAt: now,
        updatedAt: now,
      })
      .run();
    setNoteTags(db, id, tagIds);

    const note = db.select().from(notes).where(eq(notes.id, id)).get();
    if (!note) return apiError('Failed to create note', 500);
    return NextResponse.json(toNoteDTO(db, note), { status: 201 });
  } catch (err) {
    console.error('POST /api/notes failed:', err instanceof Error ? err.message : err);
    return apiError('Failed to create note', 500);
  }
}
