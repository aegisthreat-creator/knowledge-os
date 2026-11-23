/** Shared API/DTO types (serialized shapes returned by route handlers). */

export interface TagDTO {
  id: string;
  name: string;
  color: string | null;
  noteCount?: number;
  documentCount?: number;
}

export interface CollectionDTO {
  id: string;
  name: string;
  description: string | null;
  color: string | null;
  noteCount?: number;
  createdAt: string;
}

export interface NoteLinksDTO {
  outgoing: { id: string; targetNoteId: string; targetTitle: string | null }[];
  incoming: { id: string; sourceNoteId: string; sourceTitle: string | null }[];
}

export interface NoteDTO {
  id: string;
  title: string;
  content: string;
  collectionId: string | null;
  isPinned: boolean;
  isFavorite: boolean;
  createdAt: string;
  updatedAt: string;
  tags: TagDTO[];
  collection: { id: string; name: string; color: string | null } | null;
  links?: NoteLinksDTO;
}

export interface NoteListItemDTO {
  id: string;
  title: string;
  excerpt: string;
  collectionId: string | null;
  collection: { id: string; name: string; color: string | null } | null;
  isPinned: boolean;
  isFavorite: boolean;
  createdAt: string;
  updatedAt: string;
  tags: TagDTO[];
}

export type DocumentStatus = 'processing' | 'extracted' | 'failed';

export interface DocumentDTO {
  id: string;
  title: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  status: DocumentStatus;
  pageCount: number | null;
  errorMessage: string | null;
  hasExtractedText: boolean;
  createdAt: string;
  updatedAt: string;
  tags: TagDTO[];
}

export interface DeckDTO {
  id: string;
  name: string;
  description: string | null;
  sourceNoteId: string | null;
  createdAt: string;
  updatedAt: string;
  cardCount: number;
  dueCount: number;
  newCount: number;
  learnedCount: number;
}

export interface FlashcardDTO {
  id: string;
  deckId: string;
  question: string;
  answer: string;
  box: number;
  dueAt: string;
  studies: number;
  correctStudies: number;
  lastStudiedAt: string | null;
  sourceNoteId: string | null;
  createdAt: string;
  updatedAt: string;
}

export type StudyGrade = 'again' | 'hard' | 'good' | 'easy';

export interface ConversationDTO {
  id: string;
  title: string;
  model: string | null;
  createdAt: string;
  updatedAt: string;
  messageCount: number;
}

export interface MessageDTO {
  id: string;
  conversationId: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
}

export interface DashboardDTO {
  stats: {
    notes: number;
    pinned: number;
    tags: number;
    documents: number;
    decks: number;
    cards: number;
    dueToday: number;
  };
  recentNotes: NoteListItemDTO[];
  pinnedNotes: NoteListItemDTO[];
  recentDocuments: DocumentDTO[];
  activity: { date: string; notes: number; documents: number; cards: number }[];
  recentActivity: { type: 'note' | 'document' | 'study'; label: string; at: string }[];
}
