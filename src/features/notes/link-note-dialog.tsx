'use client';

import * as React from 'react';
import { Link2, Search, X } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import { useToast } from '@/components/ui/toast';
import { formatRelativeTime } from '@/lib/utils/format';
import type { NoteDTO } from '@/types';

interface LinkNoteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  note: NoteDTO;
  onLinksChanged: (links: NonNullable<NoteDTO['links']>) => void;
}

/**
 * Manual note linking: shows current links (both directions) and lets the
 * user search other notes to link to. Pairs with [[wikilinks]] in content.
 */
export function LinkNoteDialog({ open, onOpenChange, note, onLinksChanged }: LinkNoteDialogProps) {
  const { toast } = useToast();
  const [query, setQuery] = React.useState('');
  const [candidates, setCandidates] = React.useState<{ id: string; title: string; updatedAt: string }[] | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    if (!open) {
      setQuery('');
      setCandidates(null);
      return;
    }
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        const res = await fetch('/api/notes?limit=500');
        if (!res.ok) throw new Error('load failed');
        const all: { id: string; title: string; updatedAt: string }[] = await res.json();
        if (!cancelled) setCandidates(all.filter((n) => n.id !== note.id));
      } catch {
        if (!cancelled) setCandidates([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [open, note.id]);

  const outgoing = React.useMemo(() => note.links?.outgoing ?? [], [note.links]);
  const incoming = React.useMemo(() => note.links?.incoming ?? [], [note.links]);

  const filtered = React.useMemo(() => {
    if (!candidates) return [];
    const q = query.trim().toLowerCase();
    const linked = new Set(outgoing.map((l) => l.targetNoteId));
    return candidates
      .filter((n) => !linked.has(n.id))
      .filter((n) => (q ? n.title.toLowerCase().includes(q) : true))
      .slice(0, 30);
  }, [candidates, query, outgoing]);

  const link = async (targetId: string) => {
    setBusy(true);
    try {
      const res = await fetch('/api/links', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sourceNoteId: note.id, targetNoteId: targetId }),
      });
      if (!res.ok) throw new Error('link failed');
      const target = candidates?.find((c) => c.id === targetId);
      const created: { id: string } = await res.json();
      onLinksChanged({
        outgoing: [
          ...outgoing,
          { id: created.id, targetNoteId: targetId, targetTitle: target?.title ?? null },
        ],
        incoming,
      });
      toast({ title: `Linked to “${target?.title ?? 'note'}”`, variant: 'success' });
    } catch {
      toast({ title: 'Could not create the link', variant: 'error' });
    } finally {
      setBusy(false);
    }
  };

  const unlink = async (linkId: string, targetTitle: string | null) => {
    setBusy(true);
    try {
      const res = await fetch(`/api/links?id=${encodeURIComponent(linkId)}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('unlink failed');
      onLinksChanged({
        outgoing: outgoing.filter((l) => l.id !== linkId),
        incoming,
      });
      toast({ title: `Unlinked from “${targetTitle ?? 'note'}”`, variant: 'success' });
    } catch {
      toast({ title: 'Could not remove the link', variant: 'error' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Link2 className="h-4 w-4 text-primary" aria-hidden /> Linked notes
          </DialogTitle>
          <DialogDescription>
            Connect this note to others. You can also type [[Note title]] directly in the content.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Current links */}
          <div>
            <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Links from this note
            </p>
            {outgoing.length === 0 ? (
              <p className="text-sm text-muted-foreground">No outgoing links yet.</p>
            ) : (
              <ul className="space-y-1">
                {outgoing.map((l) => (
                  <li
                    key={l.id}
                    className="flex items-center gap-2 rounded-md border px-2.5 py-1.5 text-sm"
                  >
                    <span className="min-w-0 flex-1 truncate">
                      {l.targetTitle ?? 'Untitled (missing)'}
                    </span>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      className="h-6 w-6"
                      aria-label="Remove link"
                      disabled={busy}
                      onClick={() => void unlink(l.id, l.targetTitle)}
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {incoming.length > 0 ? (
            <div>
              <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Notes linking here
              </p>
              <ul className="space-y-1">
                {incoming.map((l) => (
                  <li key={l.id} className="rounded-md border px-2.5 py-1.5 text-sm text-muted-foreground">
                    {l.sourceTitle ?? 'Untitled'}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {/* Search to link */}
          <div className="border-t pt-3">
            <div className="relative mb-2">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search notes to link…"
                className="pl-9"
                aria-label="Search notes to link"
              />
            </div>
            <div className="max-h-48 overflow-y-auto">
              {loading ? (
                <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
                  <Spinner /> Loading notes…
                </div>
              ) : filtered.length === 0 ? (
                <p className="py-3 text-sm text-muted-foreground">
                  {query ? 'No matching notes.' : 'No other notes to link.'}
                </p>
              ) : (
                <ul className="space-y-1">
                  {filtered.map((n) => (
                    <li key={n.id}>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void link(n.id)}
                        className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-sm transition-colors hover:bg-accent focus-ring disabled:opacity-60"
                      >
                        <span className="min-w-0 flex-1 truncate">{n.title || 'Untitled'}</span>
                        <span className="shrink-0 text-xs text-muted-foreground">
                          {formatRelativeTime(n.updatedAt)}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
