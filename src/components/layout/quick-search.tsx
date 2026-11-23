'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Search } from 'lucide-react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Kbd } from '@/components/ui/kbd';
import { Spinner } from '@/components/ui/spinner';
import { cn } from '@/lib/utils';
import { formatRelativeTime } from '@/lib/utils/format';
import type { SearchResponse } from '@/lib/search/types';

interface QuickSearchProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Command-palette style search (⌘K). Queries the same local search API as
 * the /search page.
 */
interface FlatResult {
  type: 'note' | 'document' | 'tag';
  id: string;
  title: string;
  subtitle: string;
  updatedAt?: string;
}

export function QuickSearch({ open, onOpenChange }: QuickSearchProps) {
  const router = useRouter();
  const [query, setQuery] = React.useState('');
  const [results, setResults] = React.useState<SearchResponse | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [activeIndex, setActiveIndex] = React.useState(0);
  const inputRef = React.useRef<HTMLInputElement>(null);

  const flatResults = React.useMemo<FlatResult[]>(() => {
    if (!results) return [];
    return [
      ...results.notes.map((r) => ({
        type: 'note' as const,
        id: r.id,
        title: r.title || 'Untitled',
        subtitle: r.excerpt,
        updatedAt: r.updatedAt,
      })),
      ...results.documents.map((r) => ({
        type: 'document' as const,
        id: r.id,
        title: r.title,
        subtitle: `Document · ${r.name}`,
        updatedAt: r.updatedAt,
      })),
      ...results.tags.map((r) => ({
        type: 'tag' as const,
        id: r.id,
        title: `#${r.name}`,
        subtitle: `${r.count} note${r.count === 1 ? '' : 's'} tagged`,
      })),
    ];
  }, [results]);

  React.useEffect(() => {
    if (!open) {
      setQuery('');
      setResults(null);
      setActiveIndex(0);
      return;
    }
    const t = setTimeout(() => inputRef.current?.focus(), 50);
    return () => clearTimeout(t);
  }, [open]);

  React.useEffect(() => {
    if (!open || query.trim().length < 1) {
      setResults(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    const controller = new AbortController();
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(query.trim())}&limit=8`, {
          signal: controller.signal,
        });
        if (!res.ok) throw new Error('search failed');
        const data: SearchResponse = await res.json();
        setResults(data);
        setActiveIndex(0);
      } catch {
        if (!controller.signal.aborted) setResults(null);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 180);
    return () => {
      clearTimeout(t);
      controller.abort();
    };
  }, [query, open]);

  const navigateTo = React.useCallback(
    (item: (typeof flatResults)[number]) => {
      onOpenChange(false);
      if (item.type === 'note') router.push(`/notes/${item.id}`);
      else if (item.type === 'document') router.push(`/documents?open=${item.id}`);
      else router.push(`/search?q=${encodeURIComponent(item.title.replace(/^#/, ''))}`);
    },
    [onOpenChange, router],
  );

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, flatResults.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && flatResults[activeIndex]) {
      e.preventDefault();
      navigateTo(flatResults[activeIndex]);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="top-[18%] max-w-xl translate-y-0 gap-0 p-0 sm:max-w-xl">
        <DialogTitle className="sr-only">Search KnowledgeOS</DialogTitle>
        <div className="flex items-center gap-2 border-b px-4">
          <Search className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search notes, documents, tags…"
            className="h-12 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            aria-label="Search"
          />
          {loading ? <Spinner className="h-3.5 w-3.5" /> : <Kbd className="hidden sm:flex">esc</Kbd>}
        </div>
        <div className="max-h-[50vh] overflow-y-auto p-2">
          {!query.trim() ? (
            <p className="px-3 py-6 text-center text-sm text-muted-foreground">
              Start typing to search across your knowledge base.
            </p>
          ) : flatResults.length === 0 && !loading ? (
            <p className="px-3 py-6 text-center text-sm text-muted-foreground">
              No results for “{query.trim()}”.
            </p>
          ) : (
            <ul role="listbox" aria-label="Search results">
              {flatResults.map((item, index) => (
                <li key={`${item.type}-${item.id}`} role="option" aria-selected={index === activeIndex}>
                  <button
                    type="button"
                    onMouseEnter={() => setActiveIndex(index)}
                    onClick={() => navigateTo(item)}
                    className={cn(
                      'flex w-full items-center gap-3 rounded-md px-3 py-2 text-left transition-colors',
                      index === activeIndex ? 'bg-accent' : 'hover:bg-accent/60',
                    )}
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{item.title}</span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {item.subtitle}
                      </span>
                    </span>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {item.type === 'tag' ? 'tag' : item.type === 'document' ? 'doc' : 'note'}
                      {item.updatedAt ? ` · ${formatRelativeTime(item.updatedAt)}` : ''}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="flex items-center justify-between border-t px-4 py-2 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <Kbd>↑</Kbd>
            <Kbd>↓</Kbd> to navigate
          </span>
          <span className="flex items-center gap-1.5">
            <Kbd>↵</Kbd> to open
          </span>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** Global ⌘K / Ctrl+K listener that opens quick search. */
export function useQuickSearchHotkey(onOpen: () => void) {
  React.useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        onOpen();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onOpen]);
}
