'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowRight,
  Bot,
  FileText,
  FolderOpen,
  Layers,
  Pin,
  Plus,
  Sparkles,
  Star,
  Trophy,
  Upload,
} from 'lucide-react';
import { useApi } from '@/hooks/use-api';
import { useToast } from '@/components/ui/toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { cn } from '@/lib/utils';
import { formatBytes, formatRelativeTime } from '@/lib/utils/format';
import type { DashboardDTO, NoteListItemDTO } from '@/types';

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 5) return 'Good night';
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

function QuickCapture() {
  const router = useRouter();
  const { toast } = useToast();
  const [value, setValue] = React.useState('');
  const [saving, setSaving] = React.useState(false);

  const capture = async () => {
    const text = value.trim();
    if (!text) return;
    setSaving(true);
    try {
      const lines = text.split('\n');
      const firstLine = lines[0].slice(0, 300);
      const title = firstLine.length > 60 ? `${firstLine.slice(0, 60).trimEnd()}…` : firstLine;
      const res = await fetch('/api/notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, content: text }),
      });
      if (!res.ok) throw new Error('Failed to save');
      const note: { id: string } = await res.json();
      setValue('');
      toast({ title: 'Captured to your inbox', variant: 'success' });
      router.push(`/notes/${note.id}`);
    } catch {
      toast({ title: 'Could not save the note', variant: 'error' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" aria-hidden />
          Quick capture
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col gap-2 sm:flex-row">
          <textarea
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') void capture();
            }}
            placeholder="Jot down a thought, link, or idea… (⌘↵ to save)"
            rows={2}
            aria-label="Quick capture"
            className="min-h-[64px] flex-1 resize-none rounded-md border border-input bg-card px-3 py-2 text-sm shadow-sm focus-ring"
          />
          <Button onClick={() => void capture()} loading={saving} disabled={!value.trim()} className="sm:self-end">
            Capture
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function StatTile({
  label,
  value,
  icon: Icon,
  href,
}: {
  label: string;
  value: number;
  icon: React.ComponentType<{ className?: string }>;
  href?: string;
}) {
  const body = (
    <div className="flex items-center justify-between">
      <div>
        <p className="text-2xl font-semibold tracking-tight tabular-nums">{value.toLocaleString()}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">{label}</p>
      </div>
      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted">
        <Icon className="h-4 w-4 text-muted-foreground" aria-hidden />
      </div>
    </div>
  );
  if (href) {
    return (
      <Link
        href={href}
        className="rounded-lg border bg-card p-4 shadow-sm transition-colors hover:border-primary/40 focus-ring"
      >
        {body}
      </Link>
    );
  }
  return <div className="rounded-lg border bg-card p-4 shadow-sm">{body}</div>;
}

function NoteRow({ note }: { note: NoteListItemDTO }) {
  return (
    <li>
      <Link
        href={`/notes/${note.id}`}
        className="group flex flex-col gap-1 rounded-md px-3 py-2.5 transition-colors hover:bg-accent focus-ring"
      >
        <span className="flex items-center gap-1.5">
          {note.isPinned ? <Pin className="h-3 w-3 shrink-0 text-primary" aria-hidden /> : null}
          <span className="truncate text-sm font-medium">{note.title || 'Untitled'}</span>
          {note.isFavorite ? (
            <Star className="h-3 w-3 shrink-0 fill-warning text-warning" aria-hidden />
          ) : null}
        </span>
        <span className="line-clamp-2 text-xs text-muted-foreground">{note.excerpt || 'Empty note'}</span>
        <span className="flex items-center gap-2 text-[11px] text-muted-foreground/80">
          <span>{formatRelativeTime(note.updatedAt)}</span>
          {note.tags.slice(0, 3).map((tag) => (
            <Badge key={tag.id} variant="secondary" className="text-[10px]">
              {tag.name}
            </Badge>
          ))}
        </span>
      </Link>
    </li>
  );
}

function ActivityChart({ data }: { data: DashboardDTO['activity'] }) {
  const max = Math.max(1, ...data.map((d) => d.notes + d.documents + d.cards));
  return (
    <div className="flex h-28 items-end gap-1.5" role="img" aria-label="Activity over the last 14 days">
      {data.map((day) => {
        const total = day.notes + day.documents + day.cards;
        return (
          <div
            key={day.date}
            className="group relative flex h-full flex-1 flex-col justify-end gap-0.5"
            title={`${day.date}: ${day.notes} note updates, ${day.documents} documents, ${day.cards} card reviews`}
          >
            <div
              className="w-full rounded-t-sm bg-chart-3 transition-opacity group-hover:opacity-80"
              style={{ height: `${(day.cards / max) * 100}%` }}
            />
            <div
              className="w-full rounded-t-sm bg-chart-2 transition-opacity group-hover:opacity-80"
              style={{ height: `${(day.documents / max) * 100}%` }}
            />
            <div
              className="w-full rounded-t-sm bg-chart-1 transition-opacity group-hover:opacity-80"
              style={{ height: `${(day.notes / max) * 100}%` }}
            />
            {total === 0 ? <div className="h-1 w-full rounded-sm bg-muted" /> : null}
          </div>
        );
      })}
    </div>
  );
}

export function Dashboard() {
  const { data, loading, error, refresh } = useApi<DashboardDTO>('/api/dashboard');

  const today = new Date().toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });

  if (error) {
    return (
      <div className="p-6">
        <EmptyState
          title="Could not load the dashboard"
          description={error}
          action={
            <Button variant="outline" onClick={refresh}>
              Try again
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground">{today}</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">{greeting()}.</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Your knowledge. Your machine. Your AI.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/notes/new">
            <Button size="sm">
              <Plus className="h-4 w-4" /> New note
            </Button>
          </Link>
          <Link href="/documents">
            <Button variant="outline" size="sm">
              <Upload className="h-4 w-4" /> Upload
            </Button>
          </Link>
          <Link href="/assistant">
            <Button variant="outline" size="sm">
              <Bot className="h-4 w-4" /> Ask AI
            </Button>
          </Link>
          <Link href="/flashcards">
            <Button variant="outline" size="sm">
              <Layers className="h-4 w-4" /> Flashcards
            </Button>
          </Link>
        </div>
      </div>

      {loading || !data ? (
        <div className="space-y-4">
          <Skeleton className="h-24 w-full" />
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-20" />
            ))}
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <Skeleton className="h-72" />
            <Skeleton className="h-72" />
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <QuickCapture />

          {/* Stats */}
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
            <StatTile label="Notes" value={data.stats.notes} icon={FileText} href="/notes" />
            <StatTile label="Documents" value={data.stats.documents} icon={FolderOpen} href="/documents" />
            <StatTile label="Tags" value={data.stats.tags} icon={Sparkles} href="/library?tab=tags" />
            <StatTile label="Flashcards" value={data.stats.cards} icon={Layers} href="/flashcards" />
            <StatTile label="Due today" value={data.stats.dueToday} icon={Trophy} href="/flashcards" />
            <StatTile label="Pinned" value={data.stats.pinned} icon={Pin} href="/notes?pinned=true" />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            {/* Recent notes */}
            <Card>
              <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle>Recent notes</CardTitle>
                <Link
                  href="/notes"
                  className="flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                >
                  View all <ArrowRight className="h-3 w-3" aria-hidden />
                </Link>
              </CardHeader>
              <CardContent className="pb-3">
                {data.recentNotes.length === 0 ? (
                  <p className="py-6 text-center text-sm text-muted-foreground">
                    No notes yet — capture your first thought above.
                  </p>
                ) : (
                  <ul className="-mx-3 divide-y divide-border/60">
                    {data.recentNotes.slice(0, 5).map((note) => (
                      <NoteRow key={note.id} note={note} />
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>

            {/* Pinned + recent documents */}
            <div className="space-y-4">
              <Card>
                <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="flex items-center gap-1.5">
                    <Pin className="h-3.5 w-3.5 text-primary" aria-hidden /> Pinned
                  </CardTitle>
                </CardHeader>
                <CardContent className="pb-3">
                  {data.pinnedNotes.length === 0 ? (
                    <p className="py-3 text-center text-sm text-muted-foreground">
                      Pin notes to keep them within reach.
                    </p>
                  ) : (
                    <ul className="-mx-3 divide-y divide-border/60">
                      {data.pinnedNotes.slice(0, 3).map((note) => (
                        <NoteRow key={note.id} note={note} />
                      ))}
                    </ul>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle>Recent documents</CardTitle>
                  <Link
                    href="/documents"
                    className="flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                  >
                    View all <ArrowRight className="h-3 w-3" aria-hidden />
                  </Link>
                </CardHeader>
                <CardContent className="pb-3">
                  {data.recentDocuments.length === 0 ? (
                    <p className="py-3 text-center text-sm text-muted-foreground">
                      Import TXT, Markdown, or PDF files.
                    </p>
                  ) : (
                    <ul className="-mx-3 divide-y divide-border/60">
                      {data.recentDocuments.slice(0, 3).map((doc) => (
                        <li key={doc.id}>
                          <Link
                            href={`/documents?open=${doc.id}`}
                            className="flex items-center gap-3 px-3 py-2.5 transition-colors hover:bg-accent focus-ring"
                          >
                            <FileText className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-sm font-medium">{doc.title}</span>
                              <span className="block text-[11px] text-muted-foreground">
                                {formatBytes(doc.sizeBytes)} · {formatRelativeTime(doc.createdAt)}
                              </span>
                            </span>
                            {doc.status === 'extracted' ? (
                              <Badge variant="success">ready</Badge>
                            ) : doc.status === 'failed' ? (
                              <Badge variant="destructive">failed</Badge>
                            ) : null}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            {/* Activity chart */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle>Activity — last 14 days</CardTitle>
                <p className="text-xs text-muted-foreground">
                  <span className="inline-block h-2 w-2 rounded-sm bg-chart-1 align-middle" /> notes
                  <span className="ml-3 inline-block h-2 w-2 rounded-sm bg-chart-2 align-middle" /> documents
                  <span className="ml-3 inline-block h-2 w-2 rounded-sm bg-chart-3 align-middle" /> card reviews
                </p>
              </CardHeader>
              <CardContent>
                <ActivityChart data={data.activity} />
              </CardContent>
            </Card>

            {/* Activity feed */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle>Latest activity</CardTitle>
              </CardHeader>
              <CardContent>
                {data.recentActivity.length === 0 ? (
                  <p className="py-6 text-center text-sm text-muted-foreground">
                    Activity will appear here as you work.
                  </p>
                ) : (
                  <ul className="space-y-2.5">
                    {data.recentActivity.map((event, i) => (
                      <li key={`${event.type}-${i}`} className="flex items-start gap-2.5 text-sm">
                        <span
                          className={cn(
                            'mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full',
                            event.type === 'note' && 'bg-chart-1',
                            event.type === 'document' && 'bg-chart-2',
                            event.type === 'study' && 'bg-chart-3',
                          )}
                          aria-hidden
                        />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-foreground">{event.label}</span>
                          <span className="text-xs text-muted-foreground">
                            {event.type === 'note'
                              ? 'Note updated'
                              : event.type === 'document'
                                ? 'Document imported'
                                : 'Cards reviewed'}
                          </span>
                        </span>
                        <span className="shrink-0 text-xs text-muted-foreground">
                          {formatRelativeTime(event.at)}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </div>

          {/* AI assistant shortcut */}
          <Link
            href="/assistant"
            className="group flex items-center gap-4 rounded-lg border bg-gradient-to-r from-primary/[0.06] to-transparent p-4 transition-colors hover:border-primary/40 focus-ring"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm">
              <Bot className="h-5 w-5" aria-hidden />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold">Ask your local AI assistant</p>
              <p className="truncate text-xs text-muted-foreground">
                Summarize notes, brainstorm, study — powered by Ollama on your machine.
              </p>
            </div>
            <ArrowRight
              className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5"
              aria-hidden
            />
          </Link>
        </div>
      )}
    </div>
  );
}
