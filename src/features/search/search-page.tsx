'use client';

import * as React from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { FileText, FolderOpen, Hash, Search } from 'lucide-react';
import { useDebounce } from '@/hooks/use-debounce';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { formatRelativeTime } from '@/lib/utils/format';
import { cn } from '@/lib/utils';
import type { SearchResponse, SearchScope } from '@/lib/search/types';

function HighlightedText({ text, terms }: { text: string; terms: string[] }) {
  if (terms.length === 0) return <>{text}</>;
  const cleaned = terms.filter((t) => t.length > 0);
  if (cleaned.length === 0) return <>{text}</>;
  const escaped = cleaned.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const re = new RegExp(`(${escaped.join('|')})`, 'gi');
  const parts = text.split(re);
  const lowerTerms = cleaned.map((t) => t.toLowerCase());
  return (
    <>
      {parts.map((part, i) =>
        lowerTerms.includes(part.toLowerCase()) ? (
          <mark key={i} className="rounded-sm bg-warning/30 px-0.5 text-inherit">
            {part}
          </mark>
        ) : (
          <React.Fragment key={i}>{part}</React.Fragment>
        ),
      )}
    </>
  );
}

export function SearchPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [query, setQuery] = React.useState(searchParams.get('q') ?? '');
  const [scope, setScope] = React.useState<SearchScope>('all');
  const [results, setResults] = React.useState<SearchResponse | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const debounced = useDebounce(query, 200);
  const inputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    inputRef.current?.focus();
    const initial = searchParams.get('q');
    if (initial) setQuery(initial);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  React.useEffect(() => {
    if (!debounced.trim()) {
      setResults(null);
      setLoading(false);
      return;
    }
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const res = await fetch(
          `/api/search?q=${encodeURIComponent(debounced.trim())}&scope=${scope}&limit=20`,
          { signal: controller.signal },
        );
        if (!res.ok) throw new Error('Search failed');
        const data: SearchResponse = await res.json();
        setResults(data);
        // Keep the URL shareable without spamming history.
        router.replace(`/search?q=${encodeURIComponent(debounced.trim())}`, { scroll: false });
      } catch (err) {
        if (!controller.signal.aborted) {
          setError(err instanceof Error ? err.message : 'Search failed');
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    })();
    return () => controller.abort();
  }, [debounced, scope, router]);

  const total = results ? results.notes.length + results.documents.length + results.tags.length : 0;
  const filtered = React.useMemo(() => {
    if (!results) return null;
    if (scope === 'notes') return { ...results, documents: [], tags: [] };
    if (scope === 'documents') return { ...results, notes: [], tags: [] };
    if (scope === 'tags') return { ...results, notes: [], documents: [] };
    return results;
  }, [results, scope]);

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-6">
      <div className="mb-5">
        <h1 className="text-xl font-semibold tracking-tight">Search</h1>
        <p className="text-sm text-muted-foreground">
          Full-text search across note titles, note content, document text, and tags — indexed
          locally with SQLite FTS5.
        </p>
      </div>

      <div className="relative mb-4">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
        <Input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search everything…"
          className="h-11 pl-10 text-base"
          aria-label="Search query"
        />
      </div>

      <Tabs value={scope} onValueChange={(v) => setScope(v as SearchScope)}>
        <TabsList>
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="notes">Notes ({results?.notes.length ?? 0})</TabsTrigger>
          <TabsTrigger value="documents">Documents ({results?.documents.length ?? 0})</TabsTrigger>
          <TabsTrigger value="tags">Tags ({results?.tags.length ?? 0})</TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="mt-5">
        {!query.trim() ? (
          <EmptyState
            icon={Search}
            title="Search your knowledge base"
            description="Try a keyword, a phrase, or a tag name. Results update as you type."
          />
        ) : loading && !results ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-20" />
            ))}
          </div>
        ) : error ? (
          <EmptyState
            title="Search failed"
            description={error}
            action={
              <Button variant="outline" onClick={() => setQuery((q) => q)}>
                Retry
              </Button>
            }
          />
        ) : filtered && total === 0 ? (
          <EmptyState
            title={`No results for “${query.trim()}”`}
            description="Check the spelling or try a shorter query."
          />
        ) : filtered ? (
          <div className="space-y-6">
            {filtered.notes.length > 0 ? (
              <section>
                <h2 className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  <FileText className="h-3.5 w-3.5" aria-hidden /> Notes
                </h2>
                <ul className="divide-y divide-border rounded-lg border bg-card shadow-sm">
                  {filtered.notes.map((hit) => (
                    <li key={hit.id}>
                      <button
                        type="button"
                        onClick={() => router.push(`/notes/${hit.id}`)}
                        className="w-full px-4 py-3 text-left transition-colors hover:bg-accent focus-ring rounded-lg"
                      >
                        <span className="flex items-center justify-between gap-2">
                          <span className="truncate text-sm font-medium">
                            <HighlightedText text={hit.title} terms={hit.highlights} />
                          </span>
                          <span className="shrink-0 text-xs text-muted-foreground">
                            {formatRelativeTime(hit.updatedAt)}
                          </span>
                        </span>
                        <span className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                          <HighlightedText text={hit.excerpt} terms={hit.highlights} />
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}

            {filtered.documents.length > 0 ? (
              <section>
                <h2 className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  <FolderOpen className="h-3.5 w-3.5" aria-hidden /> Documents
                </h2>
                <ul className="divide-y divide-border rounded-lg border bg-card shadow-sm">
                  {filtered.documents.map((hit) => (
                    <li key={hit.id}>
                      <button
                        type="button"
                        onClick={() => router.push(`/documents?open=${hit.id}`)}
                        className="w-full px-4 py-3 text-left transition-colors hover:bg-accent focus-ring rounded-lg"
                      >
                        <span className="flex items-center justify-between gap-2">
                          <span className="truncate text-sm font-medium">
                            <HighlightedText text={hit.title} terms={hit.highlights} />
                          </span>
                          <span className="shrink-0 text-xs text-muted-foreground">
                            {formatRelativeTime(hit.updatedAt)}
                          </span>
                        </span>
                        <span className="mt-1 block truncate text-xs text-muted-foreground">
                          {hit.name}
                        </span>
                        {hit.excerpt ? (
                          <span className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                            <HighlightedText text={hit.excerpt} terms={hit.highlights} />
                          </span>
                        ) : null}
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}

            {filtered.tags.length > 0 ? (
              <section>
                <h2 className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  <Hash className="h-3.5 w-3.5" aria-hidden /> Tags
                </h2>
                <div className="flex flex-wrap gap-2">
                  {filtered.tags.map((tag) => (
                    <button
                      key={tag.id}
                      type="button"
                      onClick={() => {
                        setScope('all');
                        setQuery(tag.name);
                      }}
                      className={cn(
                        'rounded-full border bg-card px-3 py-1.5 text-sm shadow-sm transition-colors hover:border-primary/50 focus-ring',
                      )}
                    >
                      {tag.name}
                      <Badge variant="secondary" className="ml-1.5 text-[10px]">
                        {tag.count}
                      </Badge>
                    </button>
                  ))}
                </div>
              </section>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
