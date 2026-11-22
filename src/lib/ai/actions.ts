import { z } from 'zod';
import type { ChatMessage } from './client';

/** Assistant system prompt — concise, local-first, no fabricated context. */
export const ASSISTANT_SYSTEM_PROMPT = `You are the KnowledgeOS assistant, an AI helper that runs locally on the user's machine.
Be concise, clear and practical. Use Markdown formatting when it helps (lists, headings, bold).
When the user shares a note or document excerpt, ground your answer in that text.
If you are unsure, say so plainly instead of guessing. Reply in the language the user writes in.`;

export interface NoteActionDefinition {
  id: string;
  label: string;
  description: string;
  structured?: boolean;
}

export const NOTE_ACTIONS: NoteActionDefinition[] = [
  { id: 'summarize', label: 'Summarize', description: 'A concise summary of the note' },
  { id: 'explain', label: 'Explain simply', description: 'The idea explained in plain language' },
  { id: 'key-points', label: 'Key points', description: 'The essential points as a list' },
  { id: 'questions', label: 'Study questions', description: 'Questions to test understanding' },
  {
    id: 'flashcards',
    label: 'Create flashcards',
    description: 'Question/answer pairs for spaced practice',
    structured: true,
  },
  { id: 'improve', label: 'Improve writing', description: 'Clearer prose, same meaning' },
  { id: 'concepts', label: 'Extract concepts', description: 'Key concepts and terms defined' },
];

interface NoteContext {
  title: string;
  content: string;
}

const ACTION_INSTRUCTIONS: Record<string, string> = {
  summarize:
    'Summarize the following note in a few tight paragraphs (or bullets if the structure calls for it). Preserve the key facts and conclusions.',
  explain:
    'Explain the core idea of the following note in plain, simple language, as if to someone encountering it for the first time. Use one concrete example where helpful.',
  'key-points':
    'Extract the key points of the following note as a Markdown bulleted list. Keep each point short and self-contained.',
  questions:
    'Write 5–8 study questions that test understanding of the following note. Answer each question right after it, in bold, so the pair can be covered during self-testing.',
  improve:
    'Rewrite the following note to improve clarity, flow and grammar while preserving its meaning, structure and language. Output only the improved note.',
  concepts:
    'Extract the important concepts from the following note. For each concept give a one-sentence definition grounded in the note. Output as a Markdown list.',
};

const flashcardInstruction = (count: number) => `Create ${count} flashcards from the following note.
Respond ONLY with a JSON array (no prose, no code fences) where each item has this exact shape:
{"question": "...", "answer": "..."}
Rules: questions must be self-contained; answers must be short and factual; cover the whole note, not just the beginning.`;

export function buildNoteActionMessages(
  action: string,
  note: NoteContext,
  count = 12,
): ChatMessage[] {
  const userPrompt =
    action === 'flashcards'
      ? `${flashcardInstruction(count)}\n\nNote title: ${note.title || 'Untitled'}\n\nNote content:\n${note.content}`
      : `${ACTION_INSTRUCTIONS[action]}\n\nNote title: ${note.title || 'Untitled'}\n\nNote content:\n${note.content}`;

  return [
    { role: 'system', content: ASSISTANT_SYSTEM_PROMPT },
    { role: 'user', content: userPrompt },
  ];
}

// Entries are validated leniently here and filtered below, so one malformed
// card from the model doesn't discard the whole batch.
const flashcardArraySchema = z.array(
  z.object({
    question: z.string(),
    answer: z.string(),
  }),
);

/**
 * Robustly extract [{question, answer}] from a model response — tolerates
 * code fences, leading prose and trailing commentary.
 */
export function parseFlashcards(
  raw: string,
  maxCount = 30,
): { question: string; answer: string }[] {
  const candidates: string[] = [];
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/gi);
  if (fenced) {
    for (const block of fenced) {
      const inner = block.replace(/```[a-z]*\s*/i, '').replace(/```/i, '');
      candidates.push(inner);
    }
  }
  candidates.push(raw);

  for (const candidate of candidates) {
    const start = candidate.indexOf('[');
    const end = candidate.lastIndexOf(']');
    if (start === -1 || end === -1 || end <= start) continue;
    const slice = candidate.slice(start, end + 1);
    try {
      const parsed = flashcardArraySchema.safeParse(JSON.parse(slice));
      if (parsed.success) {
        return parsed.data
          .filter((c) => c.question.trim() && c.answer.trim())
          .slice(0, maxCount)
          .map((c) => ({ question: c.question.trim(), answer: c.answer.trim() }));
      }
    } catch {
      // try next candidate
    }
  }
  return [];
}
