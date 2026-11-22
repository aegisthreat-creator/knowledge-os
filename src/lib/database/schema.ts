import {
  index,
  integer,
  primaryKey,
  sqliteTable,
  text,
  uniqueIndex,
} from 'drizzle-orm/sqlite-core';

/**
 * KnowledgeOS schema — SQLite via Drizzle ORM.
 *
 * Conventions:
 *  - ids: 21-char URL-safe random strings (src/lib/utils/id.ts)
 *  - timestamps: epoch milliseconds (integer, mode: timestamp_ms)
 *  - booleans: integer 0/1 (mode: boolean)
 *  - FTS5 virtual tables + triggers live in migrations/0002_fts.sql
 */

const timestamp = (name: string) =>
  integer(name, { mode: 'timestamp_ms' })
    .notNull()
    .$defaultFn(() => new Date());

const nullableTimestamp = (name: string) => integer(name, { mode: 'timestamp_ms' });

export const collections = sqliteTable('collections', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description'),
  color: text('color'),
  createdAt: timestamp('created_at'),
});

export const notes = sqliteTable(
  'notes',
  {
    id: text('id').primaryKey(),
    title: text('title').notNull().default(''),
    content: text('content').notNull().default(''),
    collectionId: text('collection_id').references(() => collections.id, {
      onDelete: 'set null',
    }),
    isPinned: integer('is_pinned', { mode: 'boolean' }).notNull().default(false),
    isFavorite: integer('is_favorite', { mode: 'boolean' }).notNull().default(false),
    createdAt: timestamp('created_at'),
    updatedAt: timestamp('updated_at'),
  },
  (t) => [
    index('notes_updated_at_idx').on(t.updatedAt),
    index('notes_collection_idx').on(t.collectionId),
    index('notes_pinned_idx').on(t.isPinned),
  ],
);

export const tags = sqliteTable(
  'tags',
  {
    id: text('id').primaryKey(),
    // Stored lowercased; uniqueness enforced case-insensitively by app + index.
    name: text('name').notNull(),
    color: text('color'),
    createdAt: timestamp('created_at'),
  },
  (t) => [uniqueIndex('tags_name_idx').on(t.name)],
);

export const noteTags = sqliteTable(
  'note_tags',
  {
    noteId: text('note_id')
      .notNull()
      .references(() => notes.id, { onDelete: 'cascade' }),
    tagId: text('tag_id')
      .notNull()
      .references(() => tags.id, { onDelete: 'cascade' }),
  },
  (t) => [primaryKey({ columns: [t.noteId, t.tagId] }), index('note_tags_tag_idx').on(t.tagId)],
);

export const documents = sqliteTable(
  'documents',
  {
    id: text('id').primaryKey(),
    title: text('title').notNull(),
    originalName: text('original_name').notNull(),
    mimeType: text('mime_type').notNull(),
    sizeBytes: integer('size_bytes').notNull(),
    /** Generated filename inside UPLOAD_DIR — never a user-controlled path. */
    storageName: text('storage_name').notNull(),
    status: text('status', { enum: ['processing', 'extracted', 'failed'] })
      .notNull()
      .default('processing'),
    extractedText: text('extracted_text'),
    pageCount: integer('page_count'),
    errorMessage: text('error_message'),
    createdAt: timestamp('created_at'),
    updatedAt: timestamp('updated_at'),
  },
  (t) => [index('documents_created_at_idx').on(t.createdAt)],
);

export const documentTags = sqliteTable(
  'document_tags',
  {
    documentId: text('document_id')
      .notNull()
      .references(() => documents.id, { onDelete: 'cascade' }),
    tagId: text('tag_id')
      .notNull()
      .references(() => tags.id, { onDelete: 'cascade' }),
  },
  (t) => [
    primaryKey({ columns: [t.documentId, t.tagId] }),
    index('document_tags_tag_idx').on(t.tagId),
  ],
);

export const flashcardDecks = sqliteTable(
  'flashcard_decks',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    description: text('description'),
    sourceNoteId: text('source_note_id').references(() => notes.id, {
      onDelete: 'set null',
    }),
    createdAt: timestamp('created_at'),
    updatedAt: timestamp('updated_at'),
  },
  (t) => [index('flashcard_decks_updated_at_idx').on(t.updatedAt)],
);

export const flashcards = sqliteTable(
  'flashcards',
  {
    id: text('id').primaryKey(),
    deckId: text('deck_id')
      .notNull()
      .references(() => flashcardDecks.id, { onDelete: 'cascade' }),
    question: text('question').notNull(),
    answer: text('answer').notNull(),
    /** Leitner box 0–5 (progress / scheduling). */
    box: integer('box').notNull().default(0),
    dueAt: timestamp('due_at').notNull(),
    studies: integer('studies').notNull().default(0),
    correctStudies: integer('correct_studies').notNull().default(0),
    lastStudiedAt: nullableTimestamp('last_studied_at'),
    sourceNoteId: text('source_note_id').references(() => notes.id, {
      onDelete: 'set null',
    }),
    createdAt: timestamp('created_at'),
    updatedAt: timestamp('updated_at'),
  },
  (t) => [
    index('flashcards_deck_idx').on(t.deckId),
    index('flashcards_due_idx').on(t.dueAt),
  ],
);

export const studyRecords = sqliteTable(
  'study_records',
  {
    id: text('id').primaryKey(),
    deckId: text('deck_id')
      .notNull()
      .references(() => flashcardDecks.id, { onDelete: 'cascade' }),
    cardId: text('card_id')
      .notNull()
      .references(() => flashcards.id, { onDelete: 'cascade' }),
    grade: text('grade', { enum: ['again', 'hard', 'good', 'easy'] }).notNull(),
    studiedAt: timestamp('studied_at'),
  },
  (t) => [
    index('study_records_deck_time_idx').on(t.deckId, t.studiedAt),
    index('study_records_card_idx').on(t.cardId),
  ],
);

export const aiConversations = sqliteTable(
  'ai_conversations',
  {
    id: text('id').primaryKey(),
    title: text('title').notNull().default('New conversation'),
    model: text('model'),
    createdAt: timestamp('created_at'),
    updatedAt: timestamp('updated_at'),
  },
  (t) => [index('ai_conversations_updated_at_idx').on(t.updatedAt)],
);

export const aiMessages = sqliteTable(
  'ai_messages',
  {
    id: text('id').primaryKey(),
    conversationId: text('conversation_id')
      .notNull()
      .references(() => aiConversations.id, { onDelete: 'cascade' }),
    role: text('role', { enum: ['user', 'assistant'] }).notNull(),
    content: text('content').notNull(),
    createdAt: timestamp('created_at'),
  },
  (t) => [index('ai_messages_conversation_idx').on(t.conversationId, t.createdAt)],
);

export const settings = sqliteTable('settings', {
  key: text('key').primaryKey(),
  /** JSON-encoded value. */
  value: text('value').notNull(),
  updatedAt: timestamp('updated_at'),
});

export const noteLinks = sqliteTable(
  'note_links',
  {
    id: text('id').primaryKey(),
    sourceNoteId: text('source_note_id')
      .notNull()
      .references(() => notes.id, { onDelete: 'cascade' }),
    targetNoteId: text('target_note_id')
      .notNull()
      .references(() => notes.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at'),
  },
  (t) => [
    uniqueIndex('note_links_pair_idx').on(t.sourceNoteId, t.targetNoteId),
    index('note_links_target_idx').on(t.targetNoteId),
  ],
);

export type Collection = typeof collections.$inferSelect;
export type Note = typeof notes.$inferSelect;
export type Tag = typeof tags.$inferSelect;
export type DocumentRecord = typeof documents.$inferSelect;
export type FlashcardDeck = typeof flashcardDecks.$inferSelect;
export type Flashcard = typeof flashcards.$inferSelect;
export type StudyRecord = typeof studyRecords.$inferSelect;
export type AiConversation = typeof aiConversations.$inferSelect;
export type AiMessage = typeof aiMessages.$inferSelect;
export type NoteLink = typeof noteLinks.$inferSelect;
