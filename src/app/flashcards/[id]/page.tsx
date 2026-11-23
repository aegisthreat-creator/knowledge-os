'use client';

import * as React from 'react';
import { useParams } from 'next/navigation';
import { DeckDetail } from '@/features/flashcards/deck-detail';

export default function DeckRoute() {
  const params = useParams<{ id: string }>();
  return <DeckDetail key={params.id} deckId={params.id} />;
}
