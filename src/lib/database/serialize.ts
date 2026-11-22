import { eq, inArray } from 'drizzle-orm';
import type { Db } from './client';
import {
  collections,
  documentTags,
  documents,
  noteTags,
  notes,
  tags,
  type Collection,
  type DocumentRecord,
  type Note,
  type Tag,
} from './schema';
import { excerpt } from '@/lib/utils/format';
import type {
  CollectionDTO,
  DocumentDTO,
  NoteDTO,
  NoteListItemDTO,
  TagDTO,
} from '@/types';

export function toTagDTO(tag: Tag): TagDTO {
  return { id: tag.id, name: tag.name, color: tag.color };
}

export function toCollectionDTO(row: Collection, noteCount?: number): CollectionDTO {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    color: row.color,
    createdAt: row.createdAt.toISOString(),
    ...(noteCount !== undefined ? { noteCount } : {}),
  };
}

/** Fetch tags for many notes in one query, grouped by noteId. */
export function getTagsForNotes(db: Db, noteIds: string[]): Map<string, TagDTO[]> {
  const grouped = new Map<string, TagDTO[]>();
  if (noteIds.length === 0) return grouped;
  const rows = db
    .select({ noteId: noteTags.noteId, id: tags.id, name: tags.name, color: tags.color })
    .from(noteTags)
    .innerJoin(tags, eq(noteTags.tagId, tags.id))
    .where(inArray(noteTags.noteId, noteIds))
    .all();
  for (const row of rows) {
    const list = grouped.get(row.noteId) ?? [];
    list.push({ id: row.id, name: row.name, color: row.color });
    grouped.set(row.noteId, list);
  }
  return grouped;
}

export function getTagsForNote(db: Db, noteId: string): TagDTO[] {
  return getTagsForNotes(db, [noteId]).get(noteId) ?? [];
}

export function getTagsForDocument(db: Db, documentId: string): TagDTO[] {
  const rows = db
    .select({ id: tags.id, name: tags.name, color: tags.color })
    .from(documentTags)
    .innerJoin(tags, eq(documentTags.tagId, tags.id))
    .where(eq(documentTags.documentId, documentId))
    .all();
  return rows.map((r) => ({ id: r.id, name: r.name, color: r.color }));
}

export function getCollectionDTO(
  db: Db,
  collectionId: string | null,
): { id: string; name: string; color: string | null } | null {
  if (!collectionId) return null;
  const row = db.select().from(collections).where(eq(collections.id, collectionId)).get();
  if (!row) return null;
  return { id: row.id, name: row.name, color: row.color };
}

export function toNoteDTO(db: Db, note: Note): NoteDTO {
  return {
    id: note.id,
    title: note.title,
    content: note.content,
    collectionId: note.collectionId,
    isPinned: note.isPinned,
    isFavorite: note.isFavorite,
    createdAt: note.createdAt.toISOString(),
    updatedAt: note.updatedAt.toISOString(),
    tags: getTagsForNote(db, note.id),
    collection: getCollectionDTO(db, note.collectionId),
  };
}

export function toNoteListItemDTO(
  db: Db,
  note: Note,
  tagMap: Map<string, TagDTO[]>,
): NoteListItemDTO {
  return {
    id: note.id,
    title: note.title,
    excerpt: excerpt(note.content),
    collectionId: note.collectionId,
    collection: getCollectionDTO(db, note.collectionId),
    isPinned: note.isPinned,
    isFavorite: note.isFavorite,
    createdAt: note.createdAt.toISOString(),
    updatedAt: note.updatedAt.toISOString(),
    tags: tagMap.get(note.id) ?? [],
  };
}

export function toDocumentDTO(db: Db, doc: DocumentRecord): DocumentDTO {
  return {
    id: doc.id,
    title: doc.title,
    originalName: doc.originalName,
    mimeType: doc.mimeType,
    sizeBytes: doc.sizeBytes,
    status: doc.status,
    pageCount: doc.pageCount,
    errorMessage: doc.errorMessage,
    hasExtractedText: Boolean(doc.extractedText && doc.extractedText.trim()),
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
    tags: getTagsForDocument(db, doc.id),
  };
}

/** Tag names for a set of note ids (for the note list page). */
export function getNoteTagMap(db: Db, noteIds: string[]): Map<string, TagDTO[]> {
  return getTagsForNotes(db, noteIds);
}

export { notes as notesTable, documents as documentsTable };
