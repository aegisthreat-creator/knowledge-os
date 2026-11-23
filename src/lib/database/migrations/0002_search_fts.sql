-- Full-text search (FTS5) for notes and documents.
-- External-content tables stay in sync via triggers; queries live in
-- src/lib/search/search.ts (an extensible provider interface allows a future
-- semantic/embedding backend to slot in beside this one).

CREATE VIRTUAL TABLE `notes_fts` USING fts5(
  `title`,
  `content`,
  content = 'notes',
  content_rowid = 'rowid',
  tokenize = 'unicode61'
);

CREATE TRIGGER `notes_fts_ai` AFTER INSERT ON `notes` BEGIN
  INSERT INTO `notes_fts` (rowid, title, content)
  VALUES (new.rowid, new.title, new.content);
END;

CREATE TRIGGER `notes_fts_ad` AFTER DELETE ON `notes` BEGIN
  INSERT INTO `notes_fts` (notes_fts, rowid, title, content)
  VALUES ('delete', old.rowid, old.title, old.content);
END;

CREATE TRIGGER `notes_fts_au` AFTER UPDATE ON `notes` BEGIN
  INSERT INTO `notes_fts` (notes_fts, rowid, title, content)
  VALUES ('delete', old.rowid, old.title, old.content);
  INSERT INTO `notes_fts` (rowid, title, content)
  VALUES (new.rowid, new.title, new.content);
END;

CREATE VIRTUAL TABLE `documents_fts` USING fts5(
  `title`,
  `original_name`,
  `extracted_text`,
  content = 'documents',
  content_rowid = 'rowid',
  tokenize = 'unicode61'
);

CREATE TRIGGER `documents_fts_ai` AFTER INSERT ON `documents` BEGIN
  INSERT INTO `documents_fts` (rowid, title, original_name, extracted_text)
  VALUES (new.rowid, new.title, new.original_name, new.extracted_text);
END;

CREATE TRIGGER `documents_fts_ad` AFTER DELETE ON `documents` BEGIN
  INSERT INTO `documents_fts` (documents_fts, rowid, title, original_name, extracted_text)
  VALUES ('delete', old.rowid, old.title, old.original_name, old.extracted_text);
END;

CREATE TRIGGER `documents_fts_au` AFTER UPDATE ON `documents` BEGIN
  INSERT INTO `documents_fts` (documents_fts, rowid, title, original_name, extracted_text)
  VALUES ('delete', old.rowid, old.title, old.original_name, old.extracted_text);
  INSERT INTO `documents_fts` (rowid, title, original_name, extracted_text)
  VALUES (new.rowid, new.title, new.original_name, new.extracted_text);
END;
