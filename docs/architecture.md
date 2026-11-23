# KnowledgeOS — Architecture

This document explains the moving parts behind the UI. Read it before contributing.

## High-level flow

```
Browser (React client components)
   │  fetch /api/* (JSON, Zod-validated)
   ▼
Next.js route handlers (src/app/api/**)
   ├── lib/database  → SQLite via Drizzle (data/knowledge.db)
   ├── lib/ai        → Ollama REST (localhost, streaming NDJSON)
   ├── lib/search    → SearchProvider (FTS5 today, semantic tomorrow)
   └── lib/storage   → sandboxed uploads (data/uploads)
```

- **Pages are client components** that fetch from the API — this keeps mutation
  flows (autosave, streaming chat, study sessions) simple and consistent.
- **Route handlers** are the only code that touches the database or Ollama.
- **Serialization** happens in `lib/database/serialize.ts` (Dates → ISO strings,
  tags joined in), so the client only ever sees plain DTOs (`src/types`).

## Database

SQLite file managed by Drizzle ORM. Migrations are plain SQL in
`src/lib/database/migrations/NNNN_name.sql`, applied transactionally and
tracked with `PRAGMA user_version` (`lib/database/migrate.ts`). Migrations run
lazily on first database access.

### Tables

| Table | Purpose |
| --- | --- |
| `notes` | id, title, markdown content, collection FK, pinned/favorite flags, timestamps |
| `tags`, `note_tags` | lowercased unique tags, many-to-many with notes |
| `collections` | optional grouping (notes move freely; deleting a collection keeps notes) |
| `documents` | upload metadata, server-generated storage name, extraction status/text/error |
| `document_tags` | many-to-many documents ↔ tags |
| `flashcard_decks`, `flashcards` | decks; cards carry Leitner `box`, `due_at`, review stats |
| `study_records` | one row per grading (deck, card, grade, time) |
| `ai_conversations`, `ai_messages` | local chat history (user/assistant messages) |
| `settings` | JSON-encoded key/value (Ollama URL, default model) |
| `note_links` | explicit source → target note links |
| `notes_fts`, `documents_fts` | FTS5 external-content virtual tables |

### FTS5 sync

Triggers on `notes`/`documents` keep the FTS tables in sync on insert/update/delete
(`0002_search_fts.sql`). Queries go through `lib/search/search.ts`:

- User input is reduced to alphanumeric tokens → `"<token>"* AND …` — this makes
  FTS injection impossible and gives prefix search behavior.
- Results include `bm25` ranking and `snippet()` excerpts; tags use `LIKE`.
- The provider interface (`SearchProvider`) is the extension point for a future
  embedding-based provider.

## AI layer (Ollama)

All Ollama traffic lives in `lib/ai/`:

| Module | Responsibility |
| --- | --- |
| `config.ts` | URL resolution: Settings value → env → `http://127.0.0.1:11434` |
| `client.ts` | `checkOllama` (4s timeout), `streamChat` (NDJSON + idle watchdog), `chatComplete` (120s), friendly error mapping (`ollama pull …` hints) |
| `actions.ts` | Assistant system prompt, the seven note-action prompt builders, robust `parseFlashcards` (fenced/prose-tolerant JSON extraction) |

### Chat protocol

`POST /api/ai/chat` opens the upstream Ollama stream first (so connection
errors return clean JSON errors), then proxies tokens as NDJSON:

```jsonc
{"type":"token","token":"Hello"}
{"type":"done","conversationId":"…","title":"…"}
{"type":"error","message":"…"}
```

The server persists the user message before streaming and the assistant
message (including partial text on abort) when the stream ends.

### Note actions

`POST /api/ai/actions` resolves the model (explicit → Settings default →
first installed), runs a single completion, and for the `flashcards` action
returns parsed `{ question, answer }[]` that the UI files into a deck via the
bulk cards endpoint.

## Spaced repetition

`lib/flashcards/srs.ts` is a pure Leitner scheduler (boxes 0–5 → 1/2/4/7/14/30
days):

- `again` → box 0, due in 10 min
- `hard` → same box, half the interval (min 1 h)
- `good` → +1 box, `easy` → +2 boxes (capped)
- only `good`/`easy` count as correct recalls

The study endpoint applies grades in a transaction: card schedule update +
`study_records` insert, returning updated deck progress.

## Documents

Uploads accept `.txt`, `.md`, `.markdown`, `.pdf` up to `MAX_UPLOAD_MB`.

1. Filename is discarded; a random name + extension is generated and resolved
   inside `data/uploads/` (traversal attempts return `null`).
2. Extraction runs inline: UTF-8 read for text, `unpdf` for PDFs.
3. Outcome is stored honestly: `status = extracted | failed` with
   `error_message` — the UI shows failures and offers **Retry extraction**;
   nothing is ever claimed as processed when extraction failed.

## Security notes

- No raw HTML rendering in Markdown (react-markdown without `rehype-raw`).
- Every mutating endpoint validates with Zod; unknown fields are stripped.
- Upload MIME/extension allowlist + size cap; storage names are server-generated.
- Settings only accept `http(s)` URLs for the Ollama endpoint.
- Logs contain error messages, never note/document/chat content.
- `.env`, `data/` (DB + uploads) are gitignored; `.env.example` holds placeholders.

## Testing strategy

- **Unit:** migrations, FTS query builder, SRS math, flashcard parsing,
  format helpers, path safety, remark wikilink plugin.
- **Integration:** `lib/ai/client` against a real local HTTP server (mock
  Ollama) covering streaming and error mapping; search provider against a
  migrated in-memory database; API route handlers called directly with
  `Request` objects.
- **Component:** button, empty state, tag input with Testing Library (jsdom).
