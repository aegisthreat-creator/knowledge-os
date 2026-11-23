# KnowledgeOS

**Your knowledge. Your machine. Your AI.**

KnowledgeOS is a local-first AI knowledge management system: a personal knowledge base, Markdown note-taking app, document organizer, AI study assistant, semantic-ready search engine, flashcard trainer, and connected knowledge graph — running entirely on your own hardware.

No cloud AI APIs. No accounts. No telemetry. Your notes, documents, and conversations never leave your machine.

---

## Features

### Completed (working in this release)

| Area | What works |
| --- | --- |
| **Dashboard** | Welcome header, quick capture, knowledge statistics, recent/pinned notes, recent documents, 14-day activity chart, activity feed, AI shortcut, quick actions |
| **Notes** | Create, edit, delete, autosave, Markdown editor with toolbar + live preview (edit/split/preview), titles, tags, pinning, favorites, collections, sorting, filtering, previews, timestamps |
| **Knowledge library** | Notes, documents, tags, and collections in one view; favorites/pinned shortcuts; filtering, sorting, search |
| **Search** | Instant full-text search (SQLite FTS5) across note titles, note content, document text, and tags — with highlighting; ⌘K quick-search palette; extensible provider interface for future semantic search |
| **AI assistant** | Chat with streaming responses (NDJSON), model selection from installed Ollama models, connection status, configurable Ollama URL, conversation history persisted locally, clear/delete conversations, stop generation, retry on error, friendly offline guidance |
| **AI note actions** | Summarize, explain simply, key points, study questions, create flashcards (structured JSON → deck), improve writing, extract concepts — all via local Ollama, with copy / save-as-note / add-to-deck outputs |
| **Documents** | Upload TXT, Markdown, PDF; drag & drop; local text extraction (PDF via unpdf); metadata; reader view; delete; honest failure states with retry; unsupported files rejected with a clear message |
| **Flashcards** | Decks, manual card creation, AI generation from notes, flip-card study sessions, Leitner spaced-repetition scheduling, per-card review stats, deck progress/mastery, due-today counts, study history |
| **Knowledge graph** | Force-directed interactive graph of notes and tags; edges from manual links, `[[wikilinks]]`, and shared tags; drag/zoom/pan; click to navigate; tag display toggle |
| **Note linking** | Manual link dialog (link/unlink/backlinks) plus automatic `[[Note title]]` wikilink resolution in rendered Markdown |
| **Settings** | Ollama base URL + connection test, default model selection, theme, data/privacy info — persisted in the local database |
| **Theming** | Dark/light mode with persisted preference and no flash on load |
| **Persistence** | SQLite database (Drizzle ORM + migrations), uploaded files on disk — everything survives restarts |

### Planned / not yet implemented

| Area | Status |
| --- | --- |
| Semantic search / embeddings | Architecture ready (search provider interface); not implemented |
| OCR for scanned PDFs | Not implemented — scanned PDFs are reported as extraction failures |
| Automatic AI relationship discovery in the graph | Not implemented — links are manual/`[[wikilink]]`-based today |
| More document formats (DOCX, EPUB, HTML) | Not implemented |
| Multi-device sync | Out of scope by design (local-first) |
| Screenshots | To be added after the first tagged release |

---

## Tech stack

- **Next.js 15** (App Router) — application framework
- **TypeScript** (strict) — type safety end to end
- **Tailwind CSS** — styling and design tokens
- **shadcn/ui-style components** (Radix primitives, CVA, lucide-react icons)
- **SQLite** via **better-sqlite3** — local database with FTS5 full-text search
- **Drizzle ORM** — schema, queries, type-safe access
- **Ollama** — local AI inference (chat, streaming, note actions, card generation)
- **Zod** — input validation on every API boundary
- **React Hook Form** — settings and deck forms
- **react-markdown + remark-gfm** — safe Markdown rendering (no raw HTML)
- **unpdf** — PDF text extraction (server-side)
- **Vitest + Testing Library** — unit and component tests

## Architecture

```
src/
├── app/                    # Next.js App Router — pages + API route handlers
│   ├── (pages)             # /, /notes, /library, /documents, /assistant,
│   │                       # /flashcards, /graph, /search, /settings
│   └── api/                # REST-ish JSON endpoints (notes, tags, collections,
│                           # documents, search, ai/*, decks, cards, study,
│                           # links, graph, dashboard, settings)
├── components/
│   ├── ui/                 # Design-system primitives (button, dialog, toast, …)
│   ├── layout/             # App shell, sidebar, theme toggle, ⌘K quick search
│   └── markdown/           # Markdown viewer/editor + [[wikilink]] support
├── features/               # Feature modules (dashboard, notes, assistant,
│                           # documents, flashcards, graph, search, library,
│                           # settings)
├── lib/
│   ├── ai/                 # Ollama service layer (connectivity, streaming,
│   │                       # completions, prompts, note actions) — the ONLY
│   │                       # place that talks to Ollama
│   ├── database/           # Drizzle schema, SQL migrations + runner,
│   │                       # connection, settings, serializers
│   ├── search/             # SearchProvider interface + FTS5 implementation
│   ├── storage/            # Upload path safety + text extraction
│   ├── flashcards/         # Pure spaced-repetition scheduler
│   ├── markdown/           # Remark wikilink plugin
│   ├── validation/         # Zod schemas
│   ├── api/                # Shared route-handler helpers
│   └── hooks/              # useApi, useDebounce, useAiStatus
└── types/                  # Shared DTO types (serialized API shapes)
```

**Key decisions**

- **One AI service layer** (`lib/ai`): components never call Ollama directly; all requests are validated, timed out, and mapped to friendly errors in one place.
- **Migrations are plain SQL files** applied transactionally via `PRAGMA user_version`; FTS5 virtual tables are kept in sync with triggers.
- **Search is a provider interface**: today `LocalSearchProvider` (FTS5); a semantic provider can be added without touching the UI.
- **Route handlers validate everything with Zod** and return consistent `{ error }` JSON on failure.
- **Markdown is rendered without raw HTML**, so notes cannot inject scripts.

See [docs/architecture.md](docs/architecture.md) for the database schema and API map.

## Prerequisites

- **Node.js 20.19+ or 22.x** (developed and tested on Node 22 — see the unpdf note under [Installation troubleshooting](#installation-troubleshooting))
- **npm** (ships with Node)
- **Ollama** (optional — the app is fully usable without it; AI features light up when it's running)

## Installation

```bash
git clone <your-fork-url> knowledge-os
cd knowledge-os
npm install
```

### Installation troubleshooting

- **`node-gyp` fails to download Node headers** (common on offline or
  firewalled machines — better-sqlite3 compiles a native addon and normally
  fetches headers from `nodejs.org`): point npm at your local Node headers
  instead, which are already installed with Node:

  ```bash
  npm_config_nodedir="$(dirname "$(dirname "$(command -v node)")")" npm install
  # or on most Linux layouts: npm_config_nodedir=/usr/local npm install
  ```

- **`EBADENGINE` warning for `unpdf`**: unpdf declares Node ≥ 24 while this
  project is developed and tested on Node 22 — PDF text extraction has been
  verified working on Node 22 despite the warning.

## Development

```bash
npm run dev          # start 
npm run lint         # ESLint
npm run typecheck    # TypeScript (strict)
npm test             # Vitest — unit + component tests
npm run build        # production build
npm start            # serve the production build
```

The first run creates `data/knowledge.db` (SQLite) and `data/uploads/` (documents) and applies migrations automatically. Both are gitignored.

## Ollama setup

KnowledgeOS uses [Ollama](https://ollama.com) for all AI features. **No API keys are ever required.**

```bash
# 1. Install Ollama (macOS / Linux / Windows)
#    https://ollama.com/download

# 2. Start the server (if it isn't running as a service)
ollama serve

# 3. Pull a model (any chat model works)
ollama pull llama3.2
# or: qwen2.5, mistral, gemma2, …

# 4. Verify
curl http://127.0.0.1:11434/api/tags
```

Then open **Settings → Local AI** in KnowledgeOS, click **Test**, and pick your default model. The sidebar shows a green dot when Ollama is reachable.

- **Default URL:** `http://127.0.0.1:11434` (configurable — a LAN Ollama host works too)
- **If Ollama is offline:** everything except AI features keeps working; the UI explains exactly how to fix it.
- **No model hardcoded:** any installed model can be selected per conversation or as the default.

## Environment configuration

Copy `.env.example` if you want to override defaults (placeholders only — never commit `.env`):

| Variable | Default | Purpose |
| --- | --- | --- |
| `DATABASE_PATH` | `data/knowledge.db` | SQLite database location |
| `UPLOAD_DIR` | `data/uploads` | Uploaded document storage |
| `OLLAMA_BASE_URL` | `http://127.0.0.1:11434` | Fallback Ollama URL (Settings UI wins) |
| `MAX_UPLOAD_MB` | `25` | Upload size limit |

## Testing

```bash
npm test              # full suite
npm test -- --watch   # watch mode
```

The suite covers the migration runner and FTS triggers, the search query builder and FTS provider, the Ollama client (against a local mock server, including streaming), note actions/flashcard parsing, the spaced-repetition scheduler, storage path safety, API route handlers on an in-memory database, and core UI components.

## Privacy

- **Local-first:** notes, documents, flashcards, and chat history live in `data/` on your machine.
- **AI stays local:** requests go only to the Ollama URL you configure — never to a cloud provider.
- **No telemetry, no accounts, no external requests** are made by the app.
- **Uploads are sandboxed:** files are stored under `data/uploads/` with server-generated names; path traversal is rejected; only TXT/MD/PDF are accepted.
- **Untrusted content is contained:** Markdown is rendered without raw HTML; user input is Zod-validated at every API boundary.
- **Nothing sensitive is logged:** message and note contents are never written to server logs.

## Roadmap

1. **Semantic search** — embeddings via Ollama (`nomic-embed-text`) behind the existing `SearchProvider` interface
2. **OCR** for scanned PDFs (local tesseract integration)
3. **AI-suggested graph relationships** (clearly separated from today's deterministic links)
4. **More importers** — DOCX, EPUB, HTML
5. **Spaced-repetition upgrades** — SM-2 option, per-deck scheduling config
6. **Screenshots** and a demo dataset for the README

## Contributing

Contributions are welcome:

1. Fork and create a feature branch (`git checkout -b feature/my-feature`)
2. Make changes with tests where practical
3. Run `npm run lint && npm run typecheck && npm test && npm run build`
4. Open a pull request with a clear description

Please keep the project local-first: no cloud AI dependencies, no telemetry.

## License

[MIT](LICENSE)

---

*"Your knowledge. Your machine. Your AI."*
