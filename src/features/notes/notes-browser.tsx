'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FileText, FilterX, Plus, Search } from 'lucide-react';
import { useApi } from '@/hooks/use-api';
import { useToast } from '@/components/ui/toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { NativeSelect } from '@/components/ui/native-select';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { NoteCard } from './note-card';
import { cn } from '@/lib/utils';
import type { CollectionDTO, NoteListItemDTO, TagDTO } from '@/types';

type SortKey = 'updated' | 'created' | 'title';

interface NotesBrowserProps {
  /** Restrict the view (used by dashboard-style entry points). */
  fixed?: { pinned?: boolean; favorite?: boolean };
  showHeader?: boolean;
  heading?: string;
}

export function NotesBrowser({ fixed, showHeader = true, heading = 'Notes' }: NotesBrowserProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [sort, setSort] = React.useState<SortKey>('updated');
  const [collection, setCollection] = React.useState('');
  const [tag, setTag] = React.useState('');
  const [search, setSearch] = React.useState('');
  const [creating, setCreating] = React.useState(false);

  const params = new URLSearchParams({ sort });
  if (fixed?.pinned) params.set('pinned', 'true');
  if (fixed?.favorite) params.set('favorite', 'true');
  if (collection) params.set('collection', collection);
  if (tag) params.set('tag', tag);

  const { data: notes, loading, error, refresh, setData } = useApi<NoteListItemDTO[]>(
    `/api/notes?${params.toString()}`,
  );
  const { data: tags } = useApi<TagDTO[]>('/api/tags');
  const { data: collections } = useApi<CollectionDTO[]>('/api/collections');

  const filtered = React.useMemo(() => {
    if (!notes) return [];
    const q = search.trim().toLowerCase();
    if (!q) return notes;
    return notes.filter(
      (n) =>
        n.title.toLowerCase().includes(q) ||
        n.excerpt.toLowerCase().includes(q) ||
        n.tags.some((t) => t.name.includes(q)),
    );
  }, [notes, search]);

  const hasFilters = Boolean(collection || tag || search);

  const createNote = async () => {
    setCreating(true);
    try {
      const res = await fetch('/api/notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: '', content: '' }),
      });
      if (!res.ok) throw new Error('create failed');
      const note: NoteListItemDTO = await res.json();
      router.push(`/notes/${note.id}`);
    } catch {
      toast({ title: 'Could not create a note', variant: 'error' });
      setCreating(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
      {showHeader ? (
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold tracking-tight">{heading}</h1>
            <p className="text-sm text-muted-foreground">
              {notes ? `${notes.length} note${notes.length === 1 ? '' : 's'}` : 'Loading…'}
            </p>
          </div>
          <Button onClick={() => void createNote()} loading={creating}>
            <Plus className="h-4 w-4" /> New note
          </Button>
        </div>
      ) : null}

      {/* Filter bar */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative min-w-[200px] flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filter notes…"
            className="pl-9"
            aria-label="Filter notes"
          />
        </div>
        <NativeSelect
          value={sort}
          onChange={(e) => setSort(e.target.value as SortKey)}
          aria-label="Sort notes"
          className="w-40"
        >
          <option value="updated">Last updated</option>
          <option value="created">Newest first</option>
          <option value="title">Title A–Z</option>
        </NativeSelect>
        <NativeSelect
          value={collection}
          onChange={(e) => setCollection(e.target.value)}
          aria-label="Filter by collection"
          className="w-40"
        >
          <option value="">All collections</option>
          {(collections ?? []).map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </NativeSelect>
        <NativeSelect
          value={tag}
          onChange={(e) => setTag(e.target.value)}
          aria-label="Filter by tag"
          className="w-36"
        >
          <option value="">All tags</option>
          {(tags ?? []).map((t) => (
            <option key={t.id} value={t.name}>
              {t.name}
            </option>
          ))}
        </NativeSelect>
        {hasFilters ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setSearch('');
              setCollection('');
              setTag('');
            }}
          >
            <FilterX className="h-4 w-4" /> Clear
          </Button>
        ) : null}
      </div>

      {/* Results */}
      {loading ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-40" />
          ))}
        </div>
      ) : error ? (
        <EmptyState
          title="Could not load notes"
          description={error}
          action={
            <Button variant="outline" onClick={refresh}>
              Try again
            </Button>
          }
        />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={FileText}
          title={hasFilters ? 'No notes match your filters' : 'No notes yet'}
          description={
            hasFilters
              ? 'Try a different search term or clear the filters.'
              : 'Create your first note — Markdown, tags, pinning and AI actions are all built in.'
          }
          action={
            hasFilters ? (
              <Button
                variant="outline"
                onClick={() => {
                  setSearch('');
                  setCollection('');
                  setTag('');
                }}
              >
                Clear filters
              </Button>
            ) : (
              <Button onClick={() => void createNote()} loading={creating}>
                <Plus className="h-4 w-4" /> New note
              </Button>
            )
          }
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((note) => (
            <NoteCard
              key={note.id}
              note={note}
              onDeleted={(id) => setData((prev) => (prev ?? []).filter((n) => n.id !== id))}
              onChanged={(updated) =>
                setData((prev) =>
                  (prev ?? []).map((n) => (n.id === updated.id ? { ...n, ...updated } : n)),
                )
              }
            />
          ))}
        </div>
      )}

      {!showHeader ? (
        <div className={cn('mt-5 flex justify-center')}>
          <Link
            href="/notes"
            className="text-sm font-medium text-primary hover:underline focus-ring rounded"
          >
            Open full notes view →
          </Link>
        </div>
      ) : null}
    </div>
  );
}
