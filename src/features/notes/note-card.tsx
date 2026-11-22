'use client';

import * as React from 'react';
import Link from 'next/link';
import { MoreVertical, Pin, Star, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { useToast } from '@/components/ui/toast';
import { cn } from '@/lib/utils';
import { formatRelativeTime } from '@/lib/utils/format';
import type { NoteListItemDTO } from '@/types';

interface NoteCardProps {
  note: NoteListItemDTO;
  onDeleted?: (id: string) => void;
  onChanged?: (note: NoteListItemDTO) => void;
}

export function NoteCard({ note, onDeleted, onChanged }: NoteCardProps) {
  const { toast } = useToast();
  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);

  const patch = async (updates: Partial<Pick<NoteListItemDTO, 'isPinned' | 'isFavorite'>>) => {
    try {
      const res = await fetch(`/api/notes/${note.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
      if (!res.ok) throw new Error('update failed');
      const updated: NoteListItemDTO = { ...note, ...(await res.json()) };
      onChanged?.(updated);
    } catch {
      toast({ title: 'Could not update the note', variant: 'error' });
    }
  };

  const remove = async () => {
    setDeleting(true);
    try {
      const res = await fetch(`/api/notes/${note.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('delete failed');
      toast({ title: 'Note deleted', variant: 'success' });
      onDeleted?.(note.id);
    } catch {
      toast({ title: 'Could not delete the note', variant: 'error' });
    } finally {
      setDeleting(false);
      setConfirmOpen(false);
    }
  };

  return (
    <div className="group relative flex flex-col rounded-lg border bg-card p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md">
      <Link
        href={`/notes/${note.id}`}
        className="flex flex-1 flex-col focus-ring rounded-md"
        aria-label={`Open note: ${note.title || 'Untitled'}`}
      >
        <span className="flex items-start gap-1.5 pr-8">
          {note.isPinned ? <Pin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" aria-hidden /> : null}
          {note.isFavorite ? (
            <Star className="mt-0.5 h-3.5 w-3.5 shrink-0 fill-warning text-warning" aria-hidden />
          ) : null}
          <span className="line-clamp-2 text-sm font-semibold leading-snug">
            {note.title || 'Untitled'}
          </span>
        </span>
        <span className="mt-1.5 line-clamp-3 flex-1 text-xs leading-5 text-muted-foreground">
          {note.excerpt || 'Empty note — click to start writing.'}
        </span>
      </Link>

      <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t border-border/60 pt-2.5">
        {note.collection ? (
          <Badge variant="secondary" className="text-[10px]">
            {note.collection.name}
          </Badge>
        ) : null}
        {note.tags.slice(0, 3).map((tag) => (
          <Badge key={tag.id} variant="default" className="text-[10px]">
            {tag.name}
          </Badge>
        ))}
        {note.tags.length > 3 ? (
          <span className="text-[10px] text-muted-foreground">+{note.tags.length - 3}</span>
        ) : null}
        <span className="ml-auto text-[10px] text-muted-foreground">
          {formatRelativeTime(note.updatedAt)}
        </span>
      </div>

      <div className="absolute right-2 top-2 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon-sm"
              className="h-7 w-7"
              aria-label={`Actions for ${note.title || 'Untitled'}`}
            >
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={() => void patch({ isPinned: !note.isPinned })}>
              <Pin className={cn(!note.isPinned && 'text-muted-foreground')} />
              {note.isPinned ? 'Unpin' : 'Pin'}
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => void patch({ isFavorite: !note.isFavorite })}>
              <Star className={cn('fill-current', note.isFavorite ? 'text-warning' : 'text-muted-foreground')} />
              {note.isFavorite ? 'Remove favorite' : 'Add to favorites'}
            </DropdownMenuItem>
            <DropdownMenuItem destructive onSelect={() => setConfirmOpen(true)}>
              <Trash2 />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Delete this note?"
        description={`“${note.title || 'Untitled'}” will be permanently removed, along with its tags and links.`}
        confirmLabel="Delete"
        destructive
        loading={deleting}
        onConfirm={remove}
      />
    </div>
  );
}
