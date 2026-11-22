'use client';

import * as React from 'react';
import { ArrowLeft, RotateCcw, Trophy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/components/ui/toast';
import { cn } from '@/lib/utils';
import type { FlashcardDTO, StudyGrade } from '@/types';

interface StudySessionProps {
  deckId: string;
  deckName: string;
  cards: FlashcardDTO[];
  onExit: () => void;
  onStudied: () => void; // parent refreshes deck data
}

const GRADES: { grade: StudyGrade; label: string; hint: string; className: string }[] = [
  { grade: 'again', label: 'Again', hint: '10 min', className: 'border-destructive/50 text-destructive hover:bg-destructive/10' },
  { grade: 'hard', label: 'Hard', hint: 'half interval', className: 'border-warning/50 text-warning-foreground dark:text-warning hover:bg-warning/10' },
  { grade: 'good', label: 'Good', hint: '+1 box', className: 'border-success/50 text-success hover:bg-success/10' },
  { grade: 'easy', label: 'Easy', hint: '+2 boxes', className: 'border-primary/50 text-primary hover:bg-primary/10' },
];

/**
 * Study session: due + new cards, flip interaction, Leitner grading.
 * Each grading is persisted immediately so progress survives a refresh.
 */
export function StudySession({ deckId, deckName, cards, onExit, onStudied }: StudySessionProps) {
  const { toast } = useToast();
  const now = Date.now();

  const queue = React.useMemo(() => {
    const due = cards.filter((c) => new Date(c.dueAt).getTime() <= now);
    const fresh = cards.filter((c) => c.studies === 0 && new Date(c.dueAt).getTime() > now);
    const rest = cards.filter((c) => c.studies > 0 && new Date(c.dueAt).getTime() > now);
    // Study what's due first, then unseen cards; remaining reviewed cards last.
    return [...due, ...fresh, ...rest].slice(0, 100);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cards]);

  const [index, setIndex] = React.useState(0);
  const [flipped, setFlipped] = React.useState(false);
  const [results, setResults] = React.useState<{ grade: StudyGrade; correct: boolean }[]>([]);
  const [grading, setGrading] = React.useState(false);

  const card = queue[index];
  const total = queue.length;
  const studied = results.length;
  const correct = results.filter((r) => r.correct).length;
  const finished = total > 0 && index >= total;

  const grade = async (g: StudyGrade) => {
    if (!card || grading) return;
    setGrading(true);
    const correctGrade = g === 'good' || g === 'easy';
    setResults((prev) => [...prev, { grade: g, correct: correctGrade }]);
    setFlipped(false);
    setIndex((i) => i + 1);

    try {
      const res = await fetch('/api/study', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deckId, results: [{ cardId: card.id, grade: g }] }),
      });
      if (!res.ok) throw new Error('study save failed');
      onStudied();
    } catch {
      toast({
        title: 'Progress could not be saved',
        description: 'Your session continues — check the connection and try again.',
        variant: 'error',
      });
    } finally {
      setGrading(false);
    }
  };

  // Keyboard: space to flip, 1–4 to grade.
  React.useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (finished) return;
      if (e.code === 'Space') {
        e.preventDefault();
        setFlipped((f) => !f);
      } else if (flipped && ['1', '2', '3', '4'].includes(e.key)) {
        e.preventDefault();
        void grade(GRADES[Number(e.key) - 1].grade);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  });

  if (total === 0) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <Trophy className="mx-auto h-10 w-10 text-success" aria-hidden />
        <h2 className="mt-4 text-lg font-semibold">Nothing to review</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          All cards in “{deckName}” are scheduled for later. Come back when they’re due.
        </p>
        <Button className="mt-6" onClick={onExit}>
          <ArrowLeft className="h-4 w-4" /> Back to deck
        </Button>
      </div>
    );
  }

  if (finished) {
    const accuracy = studied > 0 ? Math.round((correct / studied) * 100) : 0;
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-success/15">
          <Trophy className="h-7 w-7 text-success" aria-hidden />
        </div>
        <h2 className="mt-4 text-lg font-semibold">Session complete</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {studied} card{studied === 1 ? '' : 's'} reviewed in “{deckName}”.
        </p>
        <div className="mt-6 grid grid-cols-3 gap-3">
          <div className="rounded-lg border bg-card p-3">
            <p className="text-xl font-semibold tabular-nums">{studied}</p>
            <p className="text-xs text-muted-foreground">Reviewed</p>
          </div>
          <div className="rounded-lg border bg-card p-3">
            <p className="text-xl font-semibold tabular-nums">{accuracy}%</p>
            <p className="text-xs text-muted-foreground">Recall</p>
          </div>
          <div className="rounded-lg border bg-card p-3">
            <p className="text-xl font-semibold tabular-nums">{correct}</p>
            <p className="text-xs text-muted-foreground">Correct</p>
          </div>
        </div>
        <div className="mt-6 flex justify-center gap-2">
          <Button variant="outline" onClick={onExit}>
            <ArrowLeft className="h-4 w-4" /> Back to deck
          </Button>
          <Button
            onClick={() => {
              setIndex(0);
              setFlipped(false);
              setResults([]);
            }}
          >
            <RotateCcw className="h-4 w-4" /> Study more
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-6">
      <div className="mb-4 flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={onExit}>
          <ArrowLeft className="h-4 w-4" /> Exit session
        </Button>
        <div className="ml-auto text-sm text-muted-foreground tabular-nums">
          {studied + 1} / {total}
        </div>
      </div>
      <Progress value={(studied / total) * 100} label="Session progress" />

      {/* Card */}
      <div className="flip-scene mt-6 h-72 sm:h-80">
        <div
          className={cn('flip-card', flipped && 'is-flipped')}
          role="button"
          tabIndex={0}
          aria-label={flipped ? 'Answer — press space to see the question' : 'Question — press space to reveal the answer'}
          onClick={() => setFlipped((f) => !f)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') setFlipped((f) => !f);
          }}
        >
          <div className="flip-face items-center justify-center text-center">
            <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Question
            </span>
            <p className="mt-3 whitespace-pre-wrap text-lg font-medium leading-relaxed">
              {card.question}
            </p>
            <span className="mt-auto pt-4 text-xs text-muted-foreground">
              Click or press Space to flip
            </span>
          </div>
          <div className="flip-face flip-face-back items-center justify-center text-center">
            <span className="text-xs font-medium uppercase tracking-wide text-primary">
              Answer
            </span>
            <p className="mt-3 whitespace-pre-wrap text-base leading-relaxed">{card.answer}</p>
            <span className="mt-auto pt-4 text-xs text-muted-foreground">
              How well did you know it?
            </span>
          </div>
        </div>
      </div>

      {/* Grades */}
      <div className="mt-6 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {GRADES.map((g, i) => (
          <button
            key={g.grade}
            type="button"
            disabled={!flipped || grading}
            onClick={() => void grade(g.grade)}
            className={cn(
              'rounded-lg border bg-card px-3 py-2.5 text-center transition-colors focus-ring',
              'disabled:opacity-40',
              g.className,
            )}
          >
            <span className="block text-sm font-semibold">{g.label}</span>
            <span className="block text-[11px] opacity-70">
              {g.hint} · {i + 1}
            </span>
          </button>
        ))}
      </div>

      {results.length > 0 ? (
        <p className="mt-4 text-center text-xs text-muted-foreground">
          Session so far: {correct}/{studied} correct
        </p>
      ) : null}
    </div>
  );
}
