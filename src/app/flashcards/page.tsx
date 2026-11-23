import type { Metadata } from 'next';
import { DecksPage } from '@/features/flashcards/decks-page';

export const metadata: Metadata = { title: 'Flashcards' };

export default function FlashcardsRoute() {
  return <DecksPage />;
}
