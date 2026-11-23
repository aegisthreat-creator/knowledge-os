'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { PageLoader } from '@/components/ui/spinner';
import { EmptyState } from '@/components/ui/empty-state';
import { Button } from '@/components/ui/button';

/**
 * Creates a note immediately and forwards to its editor.
 * (Static segment — takes precedence over /notes/[id].)
 */
export default function NewNotePage() {
  const router = useRouter();
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    const controller = new AbortController();
    (async () => {
      try {
        const res = await fetch('/api/notes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title: '', content: '' }),
          signal: controller.signal,
        });
        if (!res.ok) throw new Error('create failed');
        const note: { id: string } = await res.json();
        router.replace(`/notes/${note.id}`);
      } catch (err) {
        if (!controller.signal.aborted) {
          setError(err instanceof Error ? err.message : 'Could not create a note');
        }
      }
    })();
    return () => controller.abort();
  }, [router]);

  if (error) {
    return (
      <div className="p-6">
        <EmptyState
          title="Could not create a note"
          description={error}
          action={
            <Button variant="outline" onClick={() => router.replace('/notes')}>
              Back to notes
            </Button>
          }
        />
      </div>
    );
  }

  return <PageLoader label="Creating note…" />;
}
