import { z } from 'zod';

/** Shared primitives */
export const idSchema = z.string().min(1).max(64);
export const titleSchema = z.string().max(300);
export const tagNameSchema = z
  .string()
  .trim()
  .min(1)
  .max(40)
  .transform((s) => s.replace(/^#/, '').trim().toLowerCase())
  .refine((s) => s.length > 0, { message: 'Tag cannot be empty' })
  .refine((s) => /^[\p{L}\p{N}][\p{L}\p{N} _.-]*$/u.test(s), {
    message: 'Tags may contain letters, numbers, spaces, dots, dashes and underscores',
  });

export const createNoteSchema = z.object({
  title: titleSchema.optional().default(''),
  content: z.string().max(500_000).optional().default(''),
  collectionId: idSchema.nullable().optional(),
  tags: z.array(tagNameSchema).max(30).optional(),
  isPinned: z.boolean().optional(),
  isFavorite: z.boolean().optional(),
});

export const updateNoteSchema = z.object({
  title: titleSchema.optional(),
  content: z.string().max(500_000).optional(),
  collectionId: idSchema.nullable().optional(),
  tags: z.array(tagNameSchema).max(30).optional(),
  isPinned: z.boolean().optional(),
  isFavorite: z.boolean().optional(),
});

export const createTagSchema = z.object({
  name: tagNameSchema,
  color: z.string().max(32).nullable().optional(),
});

export const updateTagSchema = z.object({
  name: tagNameSchema.optional(),
  color: z.string().max(32).nullable().optional(),
});

export const createCollectionSchema = z.object({
  name: z.string().trim().min(1).max(80),
  description: z.string().max(500).nullable().optional(),
  color: z.string().max(32).nullable().optional(),
});

export const updateCollectionSchema = createCollectionSchema.partial();

export const searchQuerySchema = z.object({
  q: z.string().max(200),
  scope: z.enum(['all', 'notes', 'documents', 'tags']).optional().default('all'),
  limit: z.coerce.number().int().min(1).max(50).optional().default(12),
});

export const chatSchema = z.object({
  conversationId: idSchema.nullable().optional(),
  message: z.string().trim().min(1).max(12_000),
  model: z.string().trim().min(1).max(120),
});

export const noteActionSchema = z.object({
  noteId: idSchema,
  action: z.enum([
    'summarize',
    'explain',
    'key-points',
    'questions',
    'flashcards',
    'improve',
    'concepts',
  ]),
  model: z.string().trim().min(1).max(120).optional(),
  count: z.coerce.number().int().min(3).max(30).optional().default(12),
});

export const uploadMetadataSchema = z.object({
  title: titleSchema.optional(),
  tags: z.array(tagNameSchema).max(30).optional(),
});

export const createDeckSchema = z.object({
  name: z.string().trim().min(1).max(120),
  description: z.string().max(1000).nullable().optional(),
  sourceNoteId: idSchema.nullable().optional(),
});

export const updateDeckSchema = createDeckSchema.partial();

export const createCardSchema = z.object({
  deckId: idSchema,
  question: z.string().trim().min(1).max(5_000),
  answer: z.string().trim().min(1).max(10_000),
  sourceNoteId: idSchema.nullable().optional(),
});

export const updateCardSchema = z.object({
  question: z.string().trim().min(1).max(5_000).optional(),
  answer: z.string().trim().min(1).max(10_000).optional(),
});

export const generateCardsSchema = z.object({
  noteId: idSchema,
  count: z.coerce.number().int().min(3).max(30).optional().default(12),
  model: z.string().trim().min(1).max(120).optional(),
});

export const studyResultSchema = z.object({
  deckId: idSchema,
  results: z
    .array(
      z.object({
        cardId: idSchema,
        grade: z.enum(['again', 'hard', 'good', 'easy']),
      }),
    )
    .min(1)
    .max(500),
});

export const updateSettingsSchema = z.object({
  ollamaBaseUrl: z
    .string()
    .trim()
    .max(300)
    .refine((v) => v === '' || /^https?:\/\/[^\s]+$/i.test(v), {
      message: 'Must be an http(s) URL',
    })
    .optional(),
  defaultModel: z.string().trim().max(120).nullable().optional(),
});

export const linkNoteSchema = z.object({
  sourceNoteId: idSchema,
  targetNoteId: idSchema,
});
