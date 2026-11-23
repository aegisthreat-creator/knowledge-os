'use client';

import * as React from 'react';
import Link from 'next/link';
import { Layers, Plus, Play, Sparkles } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useApi } from '@/hooks/use-api';
import { useToast } from '@/components/ui/toast';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { Progress } from '@/components/ui/progress';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { formatRelativeTime } from '@/lib/utils/format';
import type { DeckDTO } from '@/types';

const createDeckFormSchema = z.object({
  name: z.string().trim().min(1, 'Deck name is required').max(120),
  description: z.string().max(1000).optional(),
});
type CreateDeckForm = z.infer<typeof createDeckFormSchema>;

export function DecksPage() {
  const { toast } = useToast();
  const { data: decks, loading, error, refresh, setData } = useApi<DeckDTO[]>('/api/decks');
  const [createOpen, setCreateOpen] = React.useState(false);
  const [creating, setCreating] = React.useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CreateDeckForm>({
    resolver: zodResolver(createDeckFormSchema),
    defaultValues: { name: '', description: '' },
  });

  const onSubmit = async (values: CreateDeckForm) => {
    setCreating(true);
    try {
      const res = await fetch('/api/decks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: values.name,
          description: values.description?.trim() || null,
        }),
      });
      if (!res.ok) throw new Error('create failed');
      const deck: DeckDTO = await res.json();
      setData((prev) => [deck, ...(prev ?? [])]);
      toast({ title: `Deck “${deck.name}” created`, variant: 'success' });
      setCreateOpen(false);
      reset();
    } catch {
      toast({ title: 'Could not create the deck', variant: 'error' });
    } finally {
      setCreating(false);
    }
  };

  const totalDue = (decks ?? []).reduce((sum, d) => sum + d.dueCount, 0);

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Flashcards</h1>
          <p className="text-sm text-muted-foreground">
            {decks
              ? `${decks.length} deck${decks.length === 1 ? '' : 's'}${
                  totalDue > 0 ? ` · ${totalDue} due now` : ''
                }`
              : 'Loading…'}
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4" /> New deck
        </Button>
      </div>

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-44" />
          ))}
        </div>
      ) : error ? (
        <EmptyState
          title="Could not load decks"
          description={error}
          action={
            <Button variant="outline" onClick={refresh}>
              Try again
            </Button>
          }
        />
      ) : !decks || decks.length === 0 ? (
        <EmptyState
          icon={Layers}
          title="No flashcard decks yet"
          description="Create a deck by hand, or generate cards from any note with your local AI."
          action={
            <Button onClick={() => setCreateOpen(true)}>
              <Plus className="h-4 w-4" /> New deck
            </Button>
          }
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {decks.map((deck) => {
            const mastery = deck.cardCount > 0 ? (deck.learnedCount / deck.cardCount) * 100 : 0;
            return (
              <Link
                key={deck.id}
                href={`/flashcards/${deck.id}`}
                className="group flex flex-col rounded-lg border bg-card p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md focus-ring"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
                    <Layers className="h-5 w-5 text-primary" aria-hidden />
                  </div>
                  {deck.dueCount > 0 ? (
                    <Badge variant="warning">{deck.dueCount} due</Badge>
                  ) : deck.cardCount === 0 ? (
                    <Badge variant="secondary">empty</Badge>
                  ) : (
                    <Badge variant="success">up to date</Badge>
                  )}
                </div>
                <h2 className="mt-3 text-sm font-semibold group-hover:text-primary">{deck.name}</h2>
                {deck.description ? (
                  <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{deck.description}</p>
                ) : null}
                <div className="mt-3">
                  <div className="flex justify-between text-[11px] text-muted-foreground">
                    <span>{deck.cardCount} cards</span>
                    <span>{Math.round(mastery)}% learned</span>
                  </div>
                  <Progress value={mastery} className="mt-1.5" label="Mastery" />
                </div>
                <div className="mt-4 flex items-center justify-between border-t border-border/60 pt-3 text-xs text-muted-foreground">
                  <span>Updated {formatRelativeTime(deck.updatedAt)}</span>
                  <span className="flex items-center gap-1 font-medium text-primary opacity-0 transition-opacity group-hover:opacity-100">
                    {deck.dueCount > 0 ? (
                      <>
                        <Play className="h-3 w-3" aria-hidden /> Study
                      </>
                    ) : (
                      <>
                        <Sparkles className="h-3 w-3" aria-hidden /> Open
                      </>
                    )}
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      )}

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New flashcard deck</DialogTitle>
            <DialogDescription>
              Decks can be filled manually or generated from a note with AI.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="deck-name">Name</Label>
              <Input
                id="deck-name"
                placeholder="e.g. Biology — Cell structure"
                {...register('name')}
                autoFocus
              />
              {errors.name ? (
                <p className="text-xs text-destructive">{errors.name.message}</p>
              ) : null}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="deck-description">Description (optional)</Label>
              <Textarea
                id="deck-description"
                placeholder="What is this deck for?"
                rows={2}
                {...register('description')}
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" loading={creating}>
                Create deck
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
