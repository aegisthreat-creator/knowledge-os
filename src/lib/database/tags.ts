import { eq } from 'drizzle-orm';
import type { Db } from './client';
import { documentTags, noteTags, tags, type Tag } from './schema';
import { newId } from '@/lib/utils/id';

/** Find a tag by normalized name, creating it if missing. */
export function findOrCreateTag(db: Db, name: string): Tag {
  const normalized = name.trim().toLowerCase();
  const existing = db.select().from(tags).where(eq(tags.name, normalized)).get();
  if (existing) return existing;
  const created: Tag = {
    id: newId(),
    name: normalized,
    color: null,
    createdAt: new Date(),
  };
  db.insert(tags).values(created).run();
  return created;
}

export function resolveTagIds(db: Db, names: string[]): string[] {
  const ids: string[] = [];
  const seen = new Set<string>();
  for (const name of names) {
    const tag = findOrCreateTag(db, name);
    if (seen.has(tag.id)) continue;
    seen.add(tag.id);
    ids.push(tag.id);
  }
  return ids;
}

/** Replace a note's tag set (transactional). */
export function setNoteTags(db: Db, noteId: string, tagIds: string[]): void {
  db.delete(noteTags).where(eq(noteTags.noteId, noteId)).run();
  for (const tagId of tagIds) {
    db.insert(noteTags).values({ noteId, tagId }).run();
  }
}

/** Replace a document's tag set. */
export function setDocumentTags(db: Db, documentId: string, tagIds: string[]): void {
  db.delete(documentTags).where(eq(documentTags.documentId, documentId)).run();
  for (const tagId of tagIds) {
    db.insert(documentTags).values({ documentId, tagId }).run();
  }
}
