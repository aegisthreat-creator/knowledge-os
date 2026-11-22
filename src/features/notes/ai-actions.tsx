'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import {
  BookOpen,
  Copy,
  ListChecks,
  MessageCircleQuestion,
  RefreshCw,
  Sparkles,
  Wand2,
  Lightbulb,
  Layers,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { NativeSelect } from '@/components/ui/native-select';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import { MarkdownViewer } from '@/components/markdown/markdown-viewer';
import { useToast } from '@/components/ui/toast';
import { NOTE_ACTIONS } from '@/lib/ai/actions';
import type { DeckDTO, FlashcardDTO } from '@/types';

const ACTION_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  summarize: BookOpen,
  explain: Lightbulb,
  'key-points': ListChecks,
  questions: MessageCircleQuestion,
  flashcards: Layers,
  improve: Wand2,
  concepts: Sparkles,
};

interface AiActionsProps {
  note: { id: string; title: string; content: string };
}

interface ActionResult {
  action: string;
  model: string;
  result?: string;
  cards?: { question: string; answer: string }[];
}

/**
 * Runs AI note actions against the local Ollama instance and lets the user
 * use the output: copy it, save it as a note, or file generated flashcards
 * into a deck.
 */
export function AiActions({ note }: AiActionsProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [open, setOpen] = React.useState(false);
  const [running, setRunning] = React.useState<string | null>(null);
  const [lastActionId, setLastActionId] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [result, setResult] = React.useState<ActionResult | null>(null);

  const [decks, setDecks] = React.useState<DeckDTO[]>([]);
  const [deckId, setDeckId] = React.useState('');
  const [newDeckName, setNewDeckName] = React.useState('');
  const [savingCards, setSavingCards] = React.useState(false);

  const runAction = async (actionId: string) => {
    setRunning(actionId);
    setLastActionId(actionId);
    setError(null);
    setResult(null);
    setOpen(true);
    try {
      const res = await fetch('/api/ai/actions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ noteId: note.id, action: actionId }),
      });
      const data = (await res.json().catch(() => null)) as (ActionResult & { error?: string }) | null;
      if (!res.ok || !data) {
        throw new Error(data?.error ?? 'The AI request failed.');
      }
      setResult(data);
      if (actionId === 'flashcards') {
        const deckRes = await fetch('/api/decks');
        if (deckRes.ok) {
          const list: DeckDTO[] = await deckRes.json();
          setDecks(list);
          setDeckId(list[0]?.id ?? '');
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The AI request failed.');
    } finally {
      setRunning(null);
    }
  };

  const copyResult = async () => {
    if (!result?.result) return;
    try {
      await navigator.clipboard.writeText(result.result);
      toast({ title: 'Copied to clipboard', variant: 'success' });
    } catch {
      toast({ title: 'Could not access the clipboard', variant: 'error' });
    }
  };

  const saveAsNote = async () => {
    if (!result?.result) return;
    try {
      const title = `${note.title || 'Untitled'} — ${NOTE_ACTIONS.find((a) => a.id === result.action)?.label ?? 'AI output'}`;
      const res = await fetch('/api/notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, content: result.result }),
      });
      if (!res.ok) throw new Error('save failed');
      const created: { id: string } = await res.json();
      toast({ title: 'Saved as a new note', variant: 'success' });
      setOpen(false);
      router.push(`/notes/${created.id}`);
    } catch {
      toast({ title: 'Could not save the result', variant: 'error' });
    }
  };

  const saveCards = async () => {
    if (!result?.cards?.length) return;
    setSavingCards(true);
    try {
      let targetDeckId = deckId;
      if (newDeckName.trim()) {
        const createRes = await fetch('/api/decks', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: newDeckName.trim(), sourceNoteId: note.id }),
        });
        if (!createRes.ok) throw new Error('deck create failed');
        const deck: DeckDTO = await createRes.json();
        targetDeckId = deck.id;
      }
      if (!targetDeckId) throw new Error('no deck');

      const res = await fetch(`/api/decks/${targetDeckId}/cards`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cards: result.cards.map((c) => ({ ...c, sourceNoteId: note.id })),
        }),
      });
      if (!res.ok) throw new Error('cards save failed');
      const created: FlashcardDTO[] = await res.json();
      toast({
        title: `Added ${created.length} flashcard${created.length === 1 ? '' : 's'}`,
        variant: 'success',
      });
      setOpen(false);
      setResult(null);
      setNewDeckName('');
    } catch {
      toast({ title: 'Could not save flashcards', variant: 'error' });
    } finally {
      setSavingCards(false);
    }
  };

  const actionLabel = result
    ? NOTE_ACTIONS.find((a) => a.id === result.action)?.label
    : running
      ? NOTE_ACTIONS.find((a) => a.id === running)?.label
      : null;

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" disabled={!note.content.trim()}>
            <Sparkles className="h-4 w-4" /> AI actions
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-60">
          <DropdownMenuLabel>Run with local AI</DropdownMenuLabel>
          {NOTE_ACTIONS.map((action) => {
            const Icon = ACTION_ICONS[action.id] ?? Sparkles;
            return (
              <DropdownMenuItem key={action.id} onSelect={() => void runAction(action.id)}>
                <Icon />
                <span className="flex-1">{action.label}</span>
              </DropdownMenuItem>
            );
          })}
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" aria-hidden />
              {actionLabel ?? 'AI action'}
            </DialogTitle>
            <DialogDescription>
              Generated locally with Ollama{result?.model ? ` · ${result.model}` : ''}.
            </DialogDescription>
          </DialogHeader>

          {running ? (
            <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
              <Spinner />
              Thinking — this can take a moment depending on your model…
            </div>
          ) : error ? (
            <div className="rounded-md border border-destructive/40 bg-destructive/5 p-4 text-sm">
              <p className="font-medium text-destructive">The AI request failed</p>
              <p className="mt-1 text-muted-foreground">{error}</p>
              <Button
                variant="outline"
                size="sm"
                className="mt-3"
                disabled={!lastActionId}
                onClick={() => lastActionId && void runAction(lastActionId)}
              >
                <RefreshCw className="h-3.5 w-3.5" /> Retry
              </Button>
            </div>
          ) : result ? (
            <div className="space-y-4">
              {result.result ? (
                <div className="max-h-[50vh] overflow-y-auto rounded-md border bg-muted/30 p-4">
                  <MarkdownViewer content={result.result} />
                </div>
              ) : null}

              {result.cards ? (
                <div className="space-y-3">
                  <p className="text-sm font-medium">
                    {result.cards.length} flashcards generated
                  </p>
                  <div className="max-h-[40vh] space-y-2 overflow-y-auto">
                    {result.cards.map((card, i) => (
                      <div key={i} className="rounded-md border bg-card p-3 text-sm">
                        <p className="font-medium">{card.question}</p>
                        <p className="mt-1 text-muted-foreground">{card.answer}</p>
                      </div>
                    ))}
                  </div>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <NativeSelect
                      value={deckId}
                      onChange={(e) => {
                        setDeckId(e.target.value);
                        if (e.target.value) setNewDeckName('');
                      }}
                      aria-label="Target deck"
                      className="flex-1"
                      disabled={Boolean(newDeckName.trim())}
                    >
                      <option value="">Choose a deck…</option>
                      {decks.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.name} ({d.cardCount})
                        </option>
                      ))}
                    </NativeSelect>
                    <Input
                      value={newDeckName}
                      onChange={(e) => setNewDeckName(e.target.value)}
                      placeholder="…or new deck name"
                      aria-label="New deck name"
                      className="flex-1"
                    />
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}

          {!running && result ? (
            <DialogFooter className="flex-row gap-2 sm:justify-end">
              <Button variant="outline" size="sm" onClick={() => setOpen(false)}>
                Close
              </Button>
              {result.result ? (
                <>
                  <Button variant="outline" size="sm" onClick={() => void copyResult()}>
                    <Copy className="h-4 w-4" /> Copy
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => void saveAsNote()}>
                    Save as note
                  </Button>
                </>
              ) : null}
              {result.cards ? (
                <Button
                  size="sm"
                  loading={savingCards}
                  disabled={!deckId && !newDeckName.trim()}
                  onClick={() => void saveCards()}
                >
                  <Layers className="h-4 w-4" /> Add to deck
                </Button>
              ) : null}
            </DialogFooter>
          ) : null}

          {!running && error ? (
            <DialogFooter>
              <Button variant="outline" size="sm" onClick={() => setOpen(false)}>
                Close
              </Button>
            </DialogFooter>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}
