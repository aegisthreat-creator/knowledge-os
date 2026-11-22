-- KnowledgeOS initial schema
-- Applied automatically on first run; tracked via PRAGMA user_version.

CREATE TABLE `collections` (
  `id` text PRIMARY KEY NOT NULL,
  `name` text NOT NULL,
  `description` text,
  `color` text,
  `created_at` integer NOT NULL
);

CREATE TABLE `notes` (
  `id` text PRIMARY KEY NOT NULL,
  `title` text NOT NULL DEFAULT '',
  `content` text NOT NULL DEFAULT '',
  `collection_id` text REFERENCES collections(id) ON DELETE SET NULL,
  `is_pinned` integer NOT NULL DEFAULT 0,
  `is_favorite` integer NOT NULL DEFAULT 0,
  `created_at` integer NOT NULL,
  `updated_at` integer NOT NULL
);

CREATE INDEX `notes_updated_at_idx` ON `notes` (`updated_at`);
CREATE INDEX `notes_collection_idx` ON `notes` (`collection_id`);
CREATE INDEX `notes_pinned_idx` ON `notes` (`is_pinned`);

CREATE TABLE `tags` (
  `id` text PRIMARY KEY NOT NULL,
  `name` text NOT NULL,
  `color` text,
  `created_at` integer NOT NULL
);

CREATE UNIQUE INDEX `tags_name_idx` ON `tags` (`name`);

CREATE TABLE `note_tags` (
  `note_id` text NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
  `tag_id` text NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (`note_id`, `tag_id`)
);

CREATE INDEX `note_tags_tag_idx` ON `note_tags` (`tag_id`);

CREATE TABLE `documents` (
  `id` text PRIMARY KEY NOT NULL,
  `title` text NOT NULL,
  `original_name` text NOT NULL,
  `mime_type` text NOT NULL,
  `size_bytes` integer NOT NULL,
  `storage_name` text NOT NULL,
  `status` text NOT NULL DEFAULT 'processing',
  `extracted_text` text,
  `page_count` integer,
  `error_message` text,
  `created_at` integer NOT NULL,
  `updated_at` integer NOT NULL
);

CREATE INDEX `documents_created_at_idx` ON `documents` (`created_at`);

CREATE TABLE `document_tags` (
  `document_id` text NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  `tag_id` text NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (`document_id`, `tag_id`)
);

CREATE INDEX `document_tags_tag_idx` ON `document_tags` (`tag_id`);

CREATE TABLE `flashcard_decks` (
  `id` text PRIMARY KEY NOT NULL,
  `name` text NOT NULL,
  `description` text,
  `source_note_id` text REFERENCES notes(id) ON DELETE SET NULL,
  `created_at` integer NOT NULL,
  `updated_at` integer NOT NULL
);

CREATE INDEX `flashcard_decks_updated_at_idx` ON `flashcard_decks` (`updated_at`);

CREATE TABLE `flashcards` (
  `id` text PRIMARY KEY NOT NULL,
  `deck_id` text NOT NULL REFERENCES flashcard_decks(id) ON DELETE CASCADE,
  `question` text NOT NULL,
  `answer` text NOT NULL,
  `box` integer NOT NULL DEFAULT 0,
  `due_at` integer NOT NULL,
  `studies` integer NOT NULL DEFAULT 0,
  `correct_studies` integer NOT NULL DEFAULT 0,
  `last_studied_at` integer,
  `source_note_id` text REFERENCES notes(id) ON DELETE SET NULL,
  `created_at` integer NOT NULL,
  `updated_at` integer NOT NULL
);

CREATE INDEX `flashcards_deck_idx` ON `flashcards` (`deck_id`);
CREATE INDEX `flashcards_due_idx` ON `flashcards` (`due_at`);

CREATE TABLE `study_records` (
  `id` text PRIMARY KEY NOT NULL,
  `deck_id` text NOT NULL REFERENCES flashcard_decks(id) ON DELETE CASCADE,
  `card_id` text NOT NULL REFERENCES flashcards(id) ON DELETE CASCADE,
  `grade` text NOT NULL,
  `studied_at` integer NOT NULL
);

CREATE INDEX `study_records_deck_time_idx` ON `study_records` (`deck_id`, `studied_at`);
CREATE INDEX `study_records_card_idx` ON `study_records` (`card_id`);

CREATE TABLE `ai_conversations` (
  `id` text PRIMARY KEY NOT NULL,
  `title` text NOT NULL DEFAULT 'New conversation',
  `model` text,
  `created_at` integer NOT NULL,
  `updated_at` integer NOT NULL
);

CREATE INDEX `ai_conversations_updated_at_idx` ON `ai_conversations` (`updated_at`);

CREATE TABLE `ai_messages` (
  `id` text PRIMARY KEY NOT NULL,
  `conversation_id` text NOT NULL REFERENCES ai_conversations(id) ON DELETE CASCADE,
  `role` text NOT NULL,
  `content` text NOT NULL,
  `created_at` integer NOT NULL
);

CREATE INDEX `ai_messages_conversation_idx` ON `ai_messages` (`conversation_id`, `created_at`);

CREATE TABLE `settings` (
  `key` text PRIMARY KEY NOT NULL,
  `value` text NOT NULL,
  `updated_at` integer NOT NULL
);

CREATE TABLE `note_links` (
  `id` text PRIMARY KEY NOT NULL,
  `source_note_id` text NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
  `target_note_id` text NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
  `created_at` integer NOT NULL
);

CREATE UNIQUE INDEX `note_links_pair_idx` ON `note_links` (`source_note_id`, `target_note_id`);
CREATE INDEX `note_links_target_idx` ON `note_links` (`target_note_id`);
