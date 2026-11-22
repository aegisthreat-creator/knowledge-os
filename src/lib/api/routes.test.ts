/**
 * API route handler tests — exercise the real handlers against an
 * in-memory database (same migrations as production).
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createDatabase, setDatabaseForTests, type DatabaseHandle } from '@/lib/database/client';

let handle: DatabaseHandle;

// Route modules must be imported after the test database is installed.
let notesRoute: typeof import('@/app/api/notes/route');
let noteRoute: typeof import('@/app/api/notes/[id]/route');
let searchRoute: typeof import('@/app/api/search/route');
let studyRoute: typeof import('@/app/api/study/route');
let decksRoute: typeof import('@/app/api/decks/route');
let deckRoute: typeof import('@/app/api/decks/[id]/route');
let cardsRoute: typeof import('@/app/api/decks/[id]/cards/route');

function jsonRequest(url: string, method: string, body: unknown): Request {
  return new Request(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

beforeAll(async () => {
  handle = createDatabase(':memory:');
  setDatabaseForTests(handle);

  notesRoute = await import('@/app/api/notes/route');
  noteRoute = await import('@/app/api/notes/[id]/route');
  searchRoute = await import('@/app/api/search/route');
  studyRoute = await import('@/app/api/study/route');
  decksRoute = await import('@/app/api/decks/route');
  deckRoute = await import('@/app/api/decks/[id]/route');
  cardsRoute = await import('@/app/api/decks/[id]/cards/route');
});

afterAll(() => {
  setDatabaseForTests(null);
  handle.sqlite.close();
});

describe('POST /api/notes', () => {
  let noteId = '';

  it('creates a note with tags', async () => {
    const res = await notesRoute.POST(
      jsonRequest('http://test/api/notes', 'POST', {
        title: 'Test note',
        content: 'Body with searchable content',
        tags: ['Alpha', 'beta'],
      }),
    );
    expect(res.status).toBe(201);
    const note = await res.json();
    expect(note.title).toBe('Test note');
    expect(note.tags.map((t: { name: string }) => t.name).sort()).toEqual(['alpha', 'beta']);
    noteId = note.id;
  });

  it('rejects invalid payloads', async () => {
    const res = await notesRoute.POST(
      jsonRequest('http://test/api/notes', 'POST', { title: 123 }),
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBeTruthy();
  });

  it('lists notes with filters', async () => {
    const res = await notesRoute.GET(new Request('http://test/api/notes?sort=title'));
    expect(res.status).toBe(200);
    const list = await res.json();
    expect(Array.isArray(list)).toBe(true);
    expect(list.length).toBeGreaterThanOrEqual(1);
    expect(list[0]).toHaveProperty('excerpt');
    expect(list[0]).toHaveProperty('tags');
  });

  it('filters by tag', async () => {
    const res = await notesRoute.GET(new Request('http://test/api/notes?tag=alpha'));
    const list = await res.json();
    expect(list).toHaveLength(1);
    expect(list[0].id).toBe(noteId);
  });

  it('PATCH updates fields and tags', async () => {
    const res = await noteRoute.PATCH(
      jsonRequest(`http://test/api/notes/${noteId}`, 'PATCH', {
        content: 'Updated body',
        tags: ['alpha'],
        isPinned: true,
      }),
      { params: Promise.resolve({ id: noteId }) },
    );
    expect(res.status).toBe(200);
    const note = await res.json();
    expect(note.content).toBe('Updated body');
    expect(note.isPinned).toBe(true);
    expect(note.tags).toHaveLength(1);
  });

  it('GET returns a single note with links structure', async () => {
    const res = await noteRoute.GET(new Request('http://test'), {
      params: Promise.resolve({ id: noteId }),
    });
    expect(res.status).toBe(200);
    const note = await res.json();
    expect(note.links).toEqual({ outgoing: [], incoming: [] });
  });

  it('DELETE removes the note', async () => {
    const res = await noteRoute.DELETE(new Request('http://test'), {
      params: Promise.resolve({ id: noteId }),
    });
    expect(res.status).toBe(200);
    const missing = await noteRoute.GET(new Request('http://test'), {
      params: Promise.resolve({ id: noteId }),
    });
    expect(missing.status).toBe(404);
  });
});

describe('GET /api/search', () => {
  beforeAll(async () => {
    await notesRoute.POST(
      jsonRequest('http://test', 'POST', {
        title: 'Zebras of Africa',
        content: 'Zebras have stripes that confuse predators.',
      }),
    );
  });

  it('finds notes via FTS', async () => {
    const res = await searchRoute.GET(new Request('http://test/api/search?q=zebras'));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.notes.length).toBeGreaterThan(0);
    expect(data.notes[0].title).toContain('Zebras');
    expect(data.notes[0].highlights).toContain('zebras');
  });

  it('returns empty results for no match', async () => {
    const res = await searchRoute.GET(new Request('http://test/api/search?q=qqqxyz'));
    const data = await res.json();
    expect(data.notes).toHaveLength(0);
    expect(data.documents).toHaveLength(0);
    expect(data.tags).toHaveLength(0);
  });

  it('validates the query parameter', async () => {
    const res = await searchRoute.GET(new Request('http://test/api/search?q=&limit=9999'));
    expect(res.status).toBe(400);
  });
});

describe('flashcards + study flow', () => {
  let deckId = '';
  let cardIds: string[] = [];

  it('creates a deck', async () => {
    const res = await decksRoute.POST(
      jsonRequest('http://test', 'POST', { name: 'Test deck' }),
    );
    expect(res.status).toBe(201);
    const deck = await res.json();
    deckId = deck.id;
    expect(deck.cardCount).toBe(0);
  });

  it('bulk-adds cards', async () => {
    const res = await cardsRoute.POST(
      jsonRequest(`http://test/api/decks/${deckId}/cards`, 'POST', {
        cards: [
          { question: 'Q1?', answer: 'A1' },
          { question: 'Q2?', answer: 'A2' },
        ],
      }),
      { params: Promise.resolve({ id: deckId }) },
    );
    expect(res.status).toBe(201);
    const cards = await res.json();
    expect(cards).toHaveLength(2);
    cardIds = cards.map((c: { id: string }) => c.id);
  });

  it('rejects empty cards', async () => {
    const res = await cardsRoute.POST(
      jsonRequest(`http://test`, 'POST', { cards: [{ question: '', answer: '' }] }),
      { params: Promise.resolve({ id: deckId }) },
    );
    expect(res.status).toBe(400);
  });

  it('records study results and updates scheduling', async () => {
    const res = await studyRoute.POST(
      jsonRequest('http://test/api/study', 'POST', {
        deckId,
        results: [{ cardId: cardIds[0], grade: 'good' }],
      }),
    );
    expect(res.status).toBe(200);
    const result = await res.json();
    expect(result.studied).toBe(1);
    expect(result.correct).toBe(1);

    const deckRes = await deckRoute.GET(new Request('http://test'), {
      params: Promise.resolve({ id: deckId }),
    });
    const payload = await deckRes.json();
    const graded = payload.cards.find((c: { id: string }) => c.id === cardIds[0]);
    expect(graded.box).toBe(1);
    expect(graded.studies).toBe(1);
    expect(payload.deck.cardCount).toBe(2);
  });

  it('ignores cards from another deck', async () => {
    const res = await studyRoute.POST(
      jsonRequest('http://test/api/study', 'POST', {
        deckId,
        results: [{ cardId: 'not-a-real-card', grade: 'good' }],
      }),
    );
    const result = await res.json();
    expect(result.studied).toBe(0);
  });

  it('validates study payloads', async () => {
    const res = await studyRoute.POST(
      jsonRequest('http://test', 'POST', { deckId, results: [] }),
    );
    expect(res.status).toBe(400);
  });
});
