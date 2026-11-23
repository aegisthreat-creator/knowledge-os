'use client';

import * as React from 'react';
import { useParams } from 'next/navigation';
import { NoteEditor } from '@/features/notes/note-editor';

export default function NotePage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  // Re-mount the editor when switching notes.
  return <NoteEditor key={id} id={id} />;
}
