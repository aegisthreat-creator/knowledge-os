'use client';

import * as React from 'react';
import {
  Bold,
  Code,
  Heading1,
  Italic,
  Link2,
  List,
  ListOrdered,
  Eye,
  Pencil,
  Columns2,
  Quote,
  Minus,
} from 'lucide-react';
import { MarkdownViewer } from './markdown-viewer';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type EditorMode = 'edit' | 'preview' | 'split';

interface MarkdownEditorProps {
  value: string;
  onChange: (value: string) => void;
  wikiMap?: Map<string, string>;
  placeholder?: string;
  minHeightClassName?: string;
}

interface ToolbarAction {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  apply: (value: string, selection: [number, number]) => string;
}

function wrapSelection(before: string, after: string, placeholder: string) {
  return (value: string, [start, end]: [number, number]): string => {
    const selected = value.slice(start, end) || placeholder;
    const replacement = `${before}${selected}${after}`;
    return value.slice(0, start) + replacement + value.slice(end);
  };
}

function prefixLines(prefix: string, placeholder: string) {
  return (value: string, [start, end]: [number, number]): string => {
    const selected = value.slice(start, end) || placeholder;
    const prefixed = selected
      .split('\n')
      .map((line) => `${prefix}${line}`)
      .join('\n');
    return value.slice(0, start) + prefixed + value.slice(end);
  };
}

const ACTIONS: ToolbarAction[] = [
  { icon: Bold, label: 'Bold', apply: wrapSelection('**', '**', 'bold text') },
  { icon: Italic, label: 'Italic', apply: wrapSelection('*', '*', 'italic text') },
  { icon: Heading1, label: 'Heading', apply: prefixLines('## ', 'Heading') },
  { icon: Link2, label: 'Link', apply: wrapSelection('[', '](https://)', 'link text') },
  { icon: List, label: 'Bulleted list', apply: prefixLines('- ', 'list item') },
  { icon: ListOrdered, label: 'Numbered list', apply: prefixLines('1. ', 'list item') },
  { icon: Quote, label: 'Quote', apply: prefixLines('> ', 'quote') },
  { icon: Code, label: 'Code', apply: wrapSelection('`', '`', 'code') },
  { icon: Minus, label: 'Divider', apply: (value, [start]) => `${value.slice(0, start)}\n---\n${value.slice(start)}` },
];

/**
 * Markdown editor with a formatting toolbar and edit/preview/split views.
 * The textarea keeps native undo/redo; the toolbar operates on the selection.
 */
export function MarkdownEditor({
  value,
  onChange,
  wikiMap,
  placeholder = 'Start writing in Markdown…',
  minHeightClassName = 'min-h-[50vh]',
}: MarkdownEditorProps) {
  const [mode, setMode] = React.useState<EditorMode>('edit');
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);

  const applyAction = (action: ToolbarAction) => {
    const textarea = textareaRef.current;
    const selection: [number, number] = textarea
      ? [textarea.selectionStart, textarea.selectionEnd]
      : [value.length, value.length];
    const next = action.apply(value, selection);
    onChange(next);
    requestAnimationFrame(() => {
      if (!textarea) return;
      textarea.focus();
      const caret = selection[0] + action.apply('', selection).length;
      textarea.setSelectionRange(caret, caret);
    });
  };

  const showEditor = mode === 'edit' || mode === 'split';
  const showPreview = mode === 'preview' || mode === 'split';

  return (
    <div className="flex flex-col rounded-lg border bg-card shadow-sm">
      <div className="flex items-center gap-0.5 overflow-x-auto border-b px-1.5 py-1">
        {ACTIONS.map((action) => (
          <Button
            key={action.label}
            variant="ghost"
            size="icon-sm"
            className="shrink-0"
            title={action.label}
            aria-label={action.label}
            onClick={() => applyAction(action)}
            disabled={!showEditor}
          >
            <action.icon className="h-4 w-4" />
          </Button>
        ))}
        <div className="ml-auto flex shrink-0 items-center rounded-md bg-muted p-0.5">
          {(
            [
              { key: 'edit', icon: Pencil, label: 'Edit' },
              { key: 'split', icon: Columns2, label: 'Split' },
              { key: 'preview', icon: Eye, label: 'Preview' },
            ] as const
          ).map(({ key, icon: Icon, label }) => (
            <button
              key={key}
              type="button"
              onClick={() => setMode(key)}
              aria-pressed={mode === key}
              className={cn(
                'flex h-7 items-center gap-1 rounded px-2 text-xs font-medium transition-colors focus-ring',
                mode === key ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground',
              )}
              title={`${label} view`}
            >
              <Icon className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">{label}</span>
            </button>
          ))}
        </div>
      </div>

      <div className={cn('grid', mode === 'split' && 'lg:grid-cols-2')}>
        {showEditor ? (
          <textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            spellCheck
            aria-label="Note content"
            className={cn(
              'w-full resize-none bg-transparent px-4 py-4 font-mono text-sm leading-6 text-foreground outline-none placeholder:text-muted-foreground focus-ring',
              minHeightClassName,
              mode === 'split' && 'border-b border-border lg:border-b-0 lg:border-r',
            )}
          />
        ) : null}
        {showPreview ? (
          <div
            className={cn(
              'overflow-y-auto px-4 py-4',
              minHeightClassName,
              mode === 'split' && 'max-h-[70vh]',
            )}
          >
            {value.trim() ? (
              <MarkdownViewer content={value} wikiMap={wikiMap} />
            ) : (
              <p className="text-sm text-muted-foreground">Nothing to preview yet.</p>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}
