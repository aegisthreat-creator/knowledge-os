'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Pencil,
  Play,
  Plus,
  Sparkles,
  Trash2,
} from 'lucide-react';
import { useApi } from '@/hooks/use-api';
import { useToast } from '@/components/ui/toast';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/native-select';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { StudySession } from './study-session';
import { formatRelativeTime } from '@/lib/utils/format';
import type { DeckDTO, FlashcardDTO, NoteListItemDTO } from '@/types';

interface DeckPayload {
  deck: DeckDTO;
  cards: FlashcardDTO[];
}

export function DeckDetail({ deckId }: { deckId: string }) {
  const router = useRouter();
  const { toast } = useToast();
  const { data, loading, error, refresh, setData } = useApi<DeckPayload>(
    `/api/decks/${deckId}`,
  );

  const [studying, setStudying] = React.useState(false);

  // Add card
  const [addOpen, setAddOpen] = React.useState(false);
  const [newQuestion, setNewQuestion] = React.useState('');
  const [newAnswer, setNewAnswer] = React.useState('');
  const [adding, setAdding] = React.useState(false);

  // Edit card
  const [editing, setEditing] = React.useState<FlashcardDTO | null>(null);
  const [editQuestion, setEditQuestion] = React.useState('');
  const [editAnswer, setEditAnswer] = React.useState('');
  const [savingEdit, setSavingEdit] = React.useState(false);

  // Generate from note
  const [genOpen, setGenOpen] = React.useState(false);
  const [genNoteId, setGenNoteId] = React.useState('');
  const [genCount, setGenCount] = React.useState(12);
  const [generating, setGenerating] = React.useState(false);
  const { data: notes } = useApi<NoteListItemDTO[]>(genOpen ? '/api/notes?limit=500' : null);

  // Deletes
  const [deleteCard, setDeleteCard] = React.useState<FlashcardDTO | null>(null);
  const [deleteDeckOpen, setDeleteDeckOpen] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);

  const deck = data?.deck;
  const cards = data?.cards ?? [];

  const addCard = async () => {
    if (!newQuestion.trim() || !newAnswer.trim()) return;
    setAdding(true);
    try {
      const res = await fetch(`/api/decks/${deckId}/cards`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cards: [{ question: newQuestion.trim(), answer: newAnswer.trim() }],
        }),
      });
      if (!res.ok) throw new Error('add failed');
      const created: FlashcardDTO[] = await res.json();
      setData((prev) =>
        prev ? { deck: { ...prev.deck, cardCount: prev.deck.cardCount + 1, newCount: prev.deck.newCount + 1 }, cards: [...created, ...prev.cards] } : prev,
      );
      toast({ title: 'Card added', variant: 'success' });
      setAddOpen(false);
      setNewQuestion('');
      setNewAnswer('');
    } catch {
      toast({ title: 'Could not add the card', variant: 'error' });
    } finally {
      setAdding(false);
    }
  };

  const saveEdit = async () => {
    if (!editing || !editQuestion.trim() || !editAnswer.trim()) return;
    setSavingEdit(true);
    try {
      const res = await fetch(`/api/cards/${editing.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: editQuestion.trim(), answer: editAnswer.trim() }),
      });
      if (!res.ok) throw new Error('update failed');
      setData((prev) =>
        prev
          ? {
              ...prev,
              cards: prev.cards.map((c) =>
                c.id === editing.id
                  ? { ...c, question: editQuestion.trim(), answer: editAnswer.trim() }
                  : c,
              ),
            }
          : prev,
      );
      toast({ title: 'Card updated', variant: 'success' });
      setEditing(null);
    } catch {
      toast({ title: 'Could not update the card', variant: 'error' });
    } finally {
      setSavingEdit(false);
    }
  };

  const removeCard = async () => {
    if (!deleteCard) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/cards/${deleteCard.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('delete failed');
      setData((prev) =>
        prev
          ? {
              deck: { ...prev.deck, cardCount: Math.max(0, prev.deck.cardCount - 1) },
              cards: prev.cards.filter((c) => c.id !== deleteCard.id),
            }
          : prev,
      );
      toast({ title: 'Card deleted', variant: 'success' });
    } catch {
      toast({ title: 'Could not delete the card', variant: 'error' });
    } finally {
      setDeleting(false);
      setDeleteCard(null);
    }
  };

  const generate = async () => {
    if (!genNoteId) return;
    setGenerating(true);
    try {
      const res = await fetch(`/api/decks/${deckId}/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ noteId: genNoteId, count: genCount }),
      });
      const body = (await res.json().catch(() => null)) as
        | { cards: FlashcardDTO[]; error?: string }
        | null;
      if (!res.ok || !body) throw new Error(body?.error ?? 'generate failed');
      setData((prev) =>
        prev
          ? {
              deck: {
                ...prev.deck,
                cardCount: prev.deck.cardCount + body.cards.length,
                newCount: prev.deck.newCount + body.cards.length,
              },
              cards: [...body.cards, ...prev.cards],
            }
          : prev,
      );
      toast({
        title: `Generated ${body.cards.length} cards`,
        description: `Model: ${'model' in body ? (body as { model?: string }).model : ''}`.trim(),
        variant: 'success',
      });
      setGenOpen(false);
    } catch (err) {
      toast({
        title: 'Card generation failed',
        description: err instanceof Error ? err.message : undefined,
        variant: 'error',
      });
    } finally {
      setGenerating(false);
    }
  };

  const removeDeck = async () => {
    setDeleting(true);
    try {
      const res = await fetch(`/api/decks/${deckId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('delete failed');
      toast({ title: 'Deck deleted', variant: 'success' });
      router.push('/flashcards');
    } catch {
      toast({ title: 'Could not delete the deck', variant: 'error' });
      setDeleting(false);
      setDeleteDeckOpen(false);
    }
  };

  if (loading) {
    return (
      <div className="mx-auto w-full max-w-4xl space-y-4 px-4 py-6 sm:px-6">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (error || !data || !deck) {
    return (
      <div className="p-6">
        <EmptyState
          title={error ? 'Could not load this deck' : 'Deck not found'}
          description={error ?? 'It may have been deleted.'}
          action={
            <Button onClick={() => router.push('/flashcards')}>Back to flashcards</Button>
          }
        />
      </div>
    );
  }

  if (studying) {
    return (
      <StudySession
        deckId={deckId}
        deckName={deck.name}
        cards={cards}
        onExit={() => {
          setStudying(false);
          void refresh();
        }}
        onStudied={() => undefined}
      />
    );
  }

  const dueCards = cards.filter((c) => new Date(c.dueAt).getTime() <= Date.now());

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-6 sm:px-6">
      {/* Header */}
      <div className="mb-5 flex flex-wrap items-start gap-3">
        <Link
          href="/flashcards"
          className="mt-1 flex items-center gap-1 rounded-md px-2 py-1 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-ring"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden /> Decks
        </Link>
        <div className="min-w-0 flex-1">
          <h1 className="text-xl font-semibold tracking-tight">{deck.name}</h1>
          {deck.description ? (
            <p className="mt-0.5 text-sm text-muted-foreground">{deck.description}</p>
          ) : null}
          <div className="mt-2 flex flex-wrap gap-2">
            <Badge variant="secondary">{deck.cardCount} cards</Badge>
            <Badge variant={dueCards.length > 0 ? 'warning' : 'success'}>
              {dueCards.length} due
            </Badge>
            <Badge variant="default">{deck.learnedCount} learned</Badge>
            <Badge variant="outline">updated {formatRelativeTime(deck.updatedAt)}</Badge>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => setAddOpen(true)}>
            <Plus className="h-4 w-4" /> Add card
          </Button>
          <Button variant="outline" size="sm" onClick={() => setGenOpen(true)}>
            <Sparkles className="h-4 w-4" /> Generate
          </Button>
          <Button size="sm" disabled={cards.length === 0} onClick={() => setStudying(true)}>
            <Play className="h-4 w-4" /> Study
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Delete deck"
            onClick={() => setDeleteDeckOpen(true)}
          >
            <Trash2 className="h-4 w-4 text-muted-foreground" />
          </Button>
        </div>
      </div>

      {/* Cards */}
      {cards.length === 0 ? (
        <EmptyState
          icon={Sparkles}
          title="This deck is empty"
          description="Add cards manually, or generate them from a note using your local AI."
          action={
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setAddOpen(true)}>
                <Plus className="h-4 w-4" /> Add card
              </Button>
              <Button onClick={() => setGenOpen(true)}>
                <Sparkles className="h-4 w-4" /> Generate from a note
              </Button>
            </div>
          }
        />
      ) : (
        <ul className="divide-y divide-border rounded-lg border bg-card shadow-sm">
          {cards.map((card) => {
            const due = new Date(card.dueAt).getTime() <= Date.now();
            return (
              <li key={card.id} className="flex items-start gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{card.question}</p>
                  <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">{card.answer}</p>
                  <div className="mt-1.5 flex flex-wrap gap-1.5 text-[11px] text-muted-foreground">
                    <span>Box {card.box}</span>
                    <span>·</span>
                    <span>{card.studies} reviews</span>
                    {card.studies > 0 ? (
                      <>
                        <span>·</span>
                        <span>
                          {Math.round((card.correctStudies / card.studies) * 100)}% recall
                        </span>
                      </>
                    ) : null}
                    <span>·</span>
                    <span className={due ? 'font-medium text-warning-foreground dark:text-warning' : ''}>
                      {due ? 'due now' : `due ${formatRelativeTime(card.dueAt)}`}
                    </span>
                  </div>
                </div>
                <div className="flex shrink-0 gap-1">
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Edit card"
                    onClick={() => {
                      setEditing(card);
                      setEditQuestion(card.question);
                      setEditAnswer(card.answer);
                    }}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Delete card"
                    onClick={() => setDeleteCard(card)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {/* Add card dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add a card</DialogTitle>
            <DialogDescription>Write a question and its answer.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="card-q">Question</Label>
              <Input
                id="card-q"
                value={newQuestion}
                onChange={(e) => setNewQuestion(e.target.value)}
                placeholder="What is…?"
                autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="card-a">Answer</Label>
              <Input
                id="card-a"
                value={newAnswer}
                onChange={(e) => setNewAnswer(e.target.value)}
                placeholder="The answer…"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>
              Cancel
            </Button>
            <Button
              loading={adding}
              disabled={!newQuestion.trim() || !newAnswer.trim()}
              onClick={() => void addCard()}
            >
              Add card
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit card dialog */}
      <Dialog open={Boolean(editing)} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit card</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="edit-q">Question</Label>
              <Input
                id="edit-q"
                value={editQuestion}
                onChange={(e) => setEditQuestion(e.target.value)}
                autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-a">Answer</Label>
              <Input id="edit-a" value={editAnswer} onChange={(e) => setEditAnswer(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>
              Cancel
            </Button>
            <Button loading={savingEdit} onClick={() => void saveEdit()}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Generate dialog */}
      <Dialog open={genOpen} onOpenChange={setGenOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" aria-hidden /> Generate flashcards
            </DialogTitle>
            <DialogDescription>
              Your local AI turns a note into question/answer pairs.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="gen-note">Source note</Label>
              <NativeSelect
                id="gen-note"
                value={genNoteId}
                onChange={(e) => setGenNoteId(e.target.value)}
              >
                <option value="">Choose a note…</option>
                {(notes ?? []).map((n) => (
                  <option key={n.id} value={n.id}>
                    {n.title || 'Untitled'}
                  </option>
                ))}
              </NativeSelect>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="gen-count">Number of cards</Label>
              <Input
                id="gen-count"
                type="number"
                min={3}
                max={30}
                value={genCount}
                onChange={(e) => setGenCount(Math.min(30, Math.max(3, Number(e.target.value) || 12)))}
              />
            </div>
            {notes && notes.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                You need at least one note — create one first.
              </p>
            ) : null}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setGenOpen(false)}>
              Cancel
            </Button>
            <Button loading={generating} disabled={!genNoteId} onClick={() => void generate()}>
              {generating ? 'Generating…' : 'Generate'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={Boolean(deleteCard)}
        onOpenChange={(open) => !open && setDeleteCard(null)}
        title="Delete this card?"
        description="The card and its review history will be removed."
        confirmLabel="Delete"
        destructive
        loading={deleting}
        onConfirm={removeCard}
      />
      <ConfirmDialog
        open={deleteDeckOpen}
        onOpenChange={setDeleteDeckOpen}
        title="Delete this deck?"
        description={`“${deck.name}” and all ${deck.cardCount} cards will be permanently deleted.`}
        confirmLabel="Delete deck"
        destructive
        loading={deleting}
        onConfirm={removeDeck}
      />
    </div>
  );
}
