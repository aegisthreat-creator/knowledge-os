'use client';

import * as React from 'react';
import { Plus, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface TagInputProps {
  tags: string[];
  onChange: (tags: string[]) => void;
  /** Existing tag names for autocomplete suggestions. */
  suggestions?: string[];
  placeholder?: string;
  maxTags?: number;
}

/**
 * Chip-style tag editor: type + Enter (or comma) to add, × to remove,
 * with autocomplete against existing tags.
 */
export function TagInput({
  tags,
  onChange,
  suggestions = [],
  placeholder = 'Add tag…',
  maxTags = 30,
}: TagInputProps) {
  const [draft, setDraft] = React.useState('');
  const [open, setOpen] = React.useState(false);
  const containerRef = React.useRef<HTMLDivElement>(null);

  const normalized = draft.trim().replace(/^#/, '').toLowerCase();

  const filtered = React.useMemo(() => {
    if (!normalized) return [];
    return suggestions
      .filter((s) => s.includes(normalized) && !tags.includes(s))
      .slice(0, 6);
  }, [suggestions, normalized, tags]);

  const addTag = (name: string) => {
    const value = name.trim().replace(/^#/, '').toLowerCase();
    if (!value || tags.includes(value) || tags.length >= maxTags) {
      setDraft('');
      setOpen(false);
      return;
    }
    onChange([...tags, value]);
    setDraft('');
    setOpen(false);
  };

  const removeTag = (name: string) => {
    onChange(tags.filter((t) => t !== name));
  };

  React.useEffect(() => {
    const onClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  return (
    <div ref={containerRef} className="relative">
      <div className="flex flex-wrap items-center gap-1.5 rounded-md border border-input bg-card px-2 py-1.5 shadow-sm focus-within:ring-2 focus-within:ring-ring/50">
        {tags.map((tag) => (
          <span
            key={tag}
            className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary"
          >
            {tag}
            <button
              type="button"
              onClick={() => removeTag(tag)}
              aria-label={`Remove tag ${tag}`}
              className="rounded-full p-0.5 hover:bg-primary/20 focus-ring"
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
        <input
          value={draft}
          onChange={(e) => {
            setDraft(e.target.value);
            setOpen(true);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ',') {
              e.preventDefault();
              addTag(draft);
            } else if (e.key === 'Backspace' && !draft && tags.length > 0) {
              removeTag(tags[tags.length - 1]);
            } else if (e.key === 'Escape') {
              setOpen(false);
            }
          }}
          onFocus={() => setOpen(true)}
          placeholder={tags.length >= maxTags ? 'Max tags reached' : placeholder}
          disabled={tags.length >= maxTags}
          className="min-w-[80px] flex-1 bg-transparent px-1 py-0.5 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed"
          aria-label="Add tag"
        />
        {draft.trim() ? (
          <button
            type="button"
            onClick={() => addTag(draft)}
            aria-label="Add tag now"
            className="rounded p-1 text-muted-foreground hover:text-foreground focus-ring"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
        ) : null}
      </div>

      {open && filtered.length > 0 ? (
        <ul className="absolute left-0 top-[calc(100%+4px)] z-20 w-56 overflow-hidden rounded-md border bg-popover p-1 shadow-lg animate-scale-in">
          {filtered.map((suggestion) => (
            <li key={suggestion}>
              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  addTag(suggestion);
                }}
                className={cn(
                  'w-full rounded-md px-2 py-1.5 text-left text-sm',
                  'hover:bg-accent focus-ring',
                )}
              >
                {suggestion}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
