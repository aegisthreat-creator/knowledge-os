import { describe, it, expect } from 'vitest';
import { buildNoteActionMessages, parseFlashcards, NOTE_ACTIONS } from './actions';

describe('buildNoteActionMessages', () => {
  const note = { title: 'My note', content: 'Some content about mitochondria.' };

  it('includes the system prompt and the note content', () => {
    const messages = buildNoteActionMessages('summarize', note);
    expect(messages).toHaveLength(2);
    expect(messages[0].role).toBe('system');
    expect(messages[1].role).toBe('user');
    expect(messages[1].content).toContain('My note');
    expect(messages[1].content).toContain('mitochondria');
    expect(messages[1].content).toContain('Summarize');
  });

  it('uses JSON instructions for the flashcards action', () => {
    const messages = buildNoteActionMessages('flashcards', note, 8);
    expect(messages[1].content).toContain('Create 8 flashcards');
    expect(messages[1].content).toContain('"question"');
    expect(messages[1].content).toContain('JSON array');
  });

  it('has instructions for every registered action', () => {
    for (const action of NOTE_ACTIONS) {
      const messages = buildNoteActionMessages(action.id, note);
      expect(messages[1].content.length).toBeGreaterThan(50);
    }
  });
});

describe('parseFlashcards', () => {
  it('parses a plain JSON array', () => {
    const raw = JSON.stringify([
      { question: 'Q1?', answer: 'A1' },
      { question: 'Q2?', answer: 'A2' },
    ]);
    expect(parseFlashcards(raw)).toHaveLength(2);
  });

  it('parses fenced JSON with prose around it', () => {
    const raw = `Sure! Here are your cards:
\`\`\`json
[{"question": "What is 2+2?", "answer": "4"}]
\`\`\`
Hope that helps!`;
    const cards = parseFlashcards(raw);
    expect(cards).toEqual([{ question: 'What is 2+2?', answer: '4' }]);
  });

  it('parses an array embedded in prose without fences', () => {
    const raw = 'Here you go: [{"question":"Capital of France?","answer":"Paris"}] enjoy!';
    expect(parseFlashcards(raw)).toHaveLength(1);
  });

  it('filters invalid entries and caps the count', () => {
    const raw = JSON.stringify([
      { question: '', answer: 'nope' },
      { question: 'Valid?', answer: 'Yes' },
      { question: 'Also valid?', answer: 'Yes' },
    ]);
    const cards = parseFlashcards(raw, 1);
    expect(cards).toHaveLength(1);
    expect(cards[0].question).toBe('Valid?');
  });

  it('returns an empty list for unparseable output', () => {
    expect(parseFlashcards('I cannot produce cards right now.')).toEqual([]);
    expect(parseFlashcards('[{bad json]')).toEqual([]);
    expect(parseFlashcards('')).toEqual([]);
  });
});
