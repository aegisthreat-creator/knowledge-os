'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Link2,
  Pin,
  Star,
  Trash2,
  CheckCircle2,
  AlertCircle,
  LoaderCircle,
} from 'lucide-react';
import { useApi } from '@/hooks/use-api';
import { useToast } from '@/components/ui/toast';
import { Button } from '@/components/ui/button';
import { NativeSelect } from '@/components/ui/native-select';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { MarkdownEditor } from '@/components/markdown/markdown-editor';
import { TagInput } from './tag-input';
import { AiActions } from './ai-actions';
import { LinkNoteDialog } from './link-note-dialog';
import { cn } from '@/lib/utils';
import { formatRelativeTime } from '@/lib/utils/format';
import type { CollectionDTO, NoteDTO, TagDTO } from '@/types';

interface DraftState {
  title: string;
  content: string;
  tags: string[];
  collectionId: string | null;
  isPinned: boolean;
  isFavorite: boolean;
}

type SaveState = 'idle' | 'dirty' | 'saving' | 'saved' | 'error';

const AUTOSAVE_DELAY_MS = 1200;

export function NoteEditor({ id }: { id: string }) {
  const router = useRouter();
  const { toast } = useToast();
  const { data: note, loading, error, refresh } = useApi<NoteDTO>(`/api/notes/${id}`);
  const { data: noteIndex } = useApi<{ id: string; title: string }[]>('/api/notes/index');
  const { data: allTags } = useApi<TagDTO[]>('/api/tags');
  const { data: collections } = useApi<CollectionDTO[]>('/api/collections');

  const [draft, setDraft] = React.useState<DraftState | null>(null);
  const [saveState, setSaveState] = React.useState<SaveState>('idle');
  const [linkDialogOpen, setLinkDialogOpen] = React.useState(false);
  const [confirmDelete, setConfirmDelete] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);
  const [links, setLinks] = React.useState<NonNullable<NoteDTO['links']> | null>(null);

  const draftRef = React.useRef<DraftState | null>(null);
  const timerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const dirtyRef = React.useRef(false);

  // Initialize the draft once when the note arrives.
  React.useEffect(() => {
    if (note && draftRef.current === null) {
      const initial: DraftState = {
        title: note.title,
        content: note.content,
        tags: note.tags.map((t) => t.name),
        collectionId: note.collectionId,
        isPinned: note.isPinned,
        isFavorite: note.isFavorite,
      };
      draftRef.current = initial;
      setDraft(initial);
      setLinks(note.links ?? { outgoing: [], incoming: [] });
    }
  }, [note]);

  const wikiMap = React.useMemo(() => {
    const map = new Map<string, string>();
    for (const entry of noteIndex ?? []) {
      const key = entry.title.trim().toLowerCase();
      if (key && !map.has(key)) map.set(key, entry.id);
    }
    return map;
  }, [noteIndex]);

  const performSave = React.useCallback(
    async (next: DraftState, opts?: { silent?: boolean }): Promise<boolean> => {
      if (!opts?.silent) setSaveState('saving');
      try {
        const res = await fetch(`/api/notes/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: next.title,
            content: next.content,
            tags: next.tags,
            collectionId: next.collectionId,
            isPinned: next.isPinned,
            isFavorite: next.isFavorite,
          }),
        });
        if (!res.ok) throw new Error('save failed');
        dirtyRef.current = false;
        if (!opts?.silent) setSaveState('saved');
        return true;
      } catch {
        if (!opts?.silent) setSaveState('error');
        return false;
      }
    },
    [id],
  );

  const scheduleSave = React.useCallback(
    (next: DraftState) => {
      draftRef.current = next;
      setDraft(next);
      dirtyRef.current = true;
      setSaveState('dirty');
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        void performSave(next);
      }, AUTOSAVE_DELAY_MS);
    },
    [performSave],
  );

  const update = (patch: Partial<DraftState>) => {
    if (!draftRef.current) return;
    scheduleSave({ ...draftRef.current, ...patch });
  };

  const saveNow = async () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (!draftRef.current) return;
    const ok = await performSave(draftRef.current);
    if (ok) toast({ title: 'Note saved', variant: 'success' });
    else toast({ title: 'Save failed — your changes are still here', variant: 'error' });
  };

  // Best-effort flush of unsaved changes when leaving the page.
  React.useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (dirtyRef.current && draftRef.current) {
        const payload = JSON.stringify(draftRef.current);
        void fetch(`/api/notes/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: payload,
          keepalive: true,
        }).catch(() => undefined);
      }
    };
  }, [id]);

  const removeNote = async () => {
    setDeleting(true);
    try {
      const res = await fetch(`/api/notes/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('delete failed');
      toast({ title: 'Note deleted', variant: 'success' });
      dirtyRef.current = false;
      router.push('/notes');
    } catch {
      toast({ title: 'Could not delete the note', variant: 'error' });
      setDeleting(false);
      setConfirmDelete(false);
    }
  };

  if (loading) {
    return (
      <div className="mx-auto w-full max-w-4xl space-y-4 px-4 py-6 sm:px-6">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-10 w-3/4" />
        <Skeleton className="h-9 w-full" />
        <Skeleton className="h-[50vh] w-full" />
      </div>
    );
  }

  if (error || !note || !draft) {
    return (
      <div className="p-6">
        <EmptyState
          title={error ? 'Could not load this note' : 'Note not found'}
          description={error ?? 'It may have been deleted.'}
          action={
            <div className="flex gap-2">
              {error ? (
                <Button variant="outline" onClick={refresh}>
                  Try again
                </Button>
              ) : null}
              <Button onClick={() => router.push('/notes')}>Back to notes</Button>
            </div>
          }
        />
      </div>
    );
  }

  const saveIndicator =
    saveState === 'saving' ? (
      <span className="flex items-center gap-1 text-xs text-muted-foreground">
        <LoaderCircle className="h-3 w-3 animate-spin" aria-hidden /> Saving…
      </span>
    ) : saveState === 'saved' ? (
      <span className="flex items-center gap-1 text-xs text-success">
        <CheckCircle2 className="h-3 w-3" aria-hidden /> Saved
      </span>
    ) : saveState === 'error' ? (
      <button
        type="button"
        onClick={() => void saveNow()}
        className="flex items-center gap-1 text-xs text-destructive hover:underline focus-ring rounded"
      >
        <AlertCircle className="h-3 w-3" aria-hidden /> Save failed — retry
      </button>
    ) : saveState === 'dirty' ? (
      <span className="text-xs text-muted-foreground">Unsaved changes…</span>
    ) : (
      <span className="text-xs text-muted-foreground">All changes saved</span>
    );

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-5 sm:px-6">
      {/* Top bar */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Link
          href="/notes"
          className="flex items-center gap-1 rounded-md px-2 py-1 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-ring"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden /> Notes
        </Link>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          {saveIndicator}
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={draft.isPinned ? 'Unpin note' : 'Pin note'}
            onClick={() => update({ isPinned: !draft.isPinned })}
            className={cn(draft.isPinned && 'text-primary')}
          >
            <Pin className={cn('h-4 w-4', draft.isPinned && 'fill-current')} />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={draft.isFavorite ? 'Remove favorite' : 'Add to favorites'}
            onClick={() => update({ isFavorite: !draft.isFavorite })}
            className={cn(draft.isFavorite && 'text-warning')}
          >
            <Star className={cn('h-4 w-4', draft.isFavorite && 'fill-current')} />
          </Button>
          <Button variant="ghost" size="icon-sm" aria-label="Link notes" onClick={() => setLinkDialogOpen(true)}>
            <Link2 className="h-4 w-4" />
          </Button>
          <AiActions note={{ id, title: draft.title, content: draft.content }} />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon-sm" aria-label="More actions">
                <Trash2 className="h-4 w-4 text-muted-foreground" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem destructive onSelect={() => setConfirmDelete(true)}>
                <Trash2 /> Delete note
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Title */}
      <input
        value={draft.title}
        onChange={(e) => update({ title: e.target.value })}
        placeholder="Untitled note"
        aria-label="Note title"
        className="w-full bg-transparent text-2xl font-semibold tracking-tight outline-none placeholder:text-muted-foreground/60 focus:outline-none"
      />

      {/* Meta row */}
      <div className="mt-3 flex flex-wrap items-center gap-2 border-b pb-4">
        <TagInput
          tags={draft.tags}
          onChange={(tags) => update({ tags })}
          suggestions={(allTags ?? []).map((t) => t.name)}
        />
        <NativeSelect
          value={draft.collectionId ?? ''}
          onChange={(e) => update({ collectionId: e.target.value || null })}
          aria-label="Collection"
          className="w-44"
        >
          <option value="">No collection</option>
          {(collections ?? []).map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </NativeSelect>
        <span className="ml-auto text-xs text-muted-foreground">
          Updated {formatRelativeTime(note.updatedAt)}
        </span>
      </div>

      {/* Editor */}
      <div className="mt-4">
        <MarkdownEditor
          value={draft.content}
          onChange={(content) => update({ content })}
          wikiMap={wikiMap}
        />
      </div>

      {/* Linked notes footer */}
      {links && (links.outgoing.length > 0 || links.incoming.length > 0) ? (
        <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <Link2 className="h-3.5 w-3.5" aria-hidden />
          {links.outgoing.length > 0 ? (
            <span>
              Links to{' '}
              {links.outgoing.map((l, i) => (
                <React.Fragment key={l.id}>
                  {i > 0 ? ', ' : ''}
                  <Link href={`/notes/${l.targetNoteId}`} className="text-primary hover:underline">
                    {l.targetTitle ?? 'Untitled'}
                  </Link>
                </React.Fragment>
              ))}
            </span>
          ) : null}
          {links.incoming.length > 0 ? (
            <span>
              {links.outgoing.length > 0 ? ' · ' : ''}
              {links.incoming.length} backlink{links.incoming.length === 1 ? '' : 's'}
            </span>
          ) : null}
        </div>
      ) : null}

      <LinkNoteDialog
        open={linkDialogOpen}
        onOpenChange={setLinkDialogOpen}
        note={{ ...note, links: links ?? undefined }}
        onLinksChanged={setLinks}
      />

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="Delete this note?"
        description={`“${draft.title || 'Untitled'}” will be permanently removed. This cannot be undone.`}
        confirmLabel="Delete"
        destructive
        loading={deleting}
        onConfirm={removeNote}
      />
    </div>
  );
}
