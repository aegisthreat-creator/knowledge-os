'use client';

import * as React from 'react';
import Link from 'next/link';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { remarkWikiLinks } from '@/lib/markdown/wiki-links';
import { cn } from '@/lib/utils';

interface MarkdownViewerProps {
  content: string;
  /** Lowercased note title → note id, used to resolve [[wikilinks]]. */
  wikiMap?: Map<string, string>;
  className?: string;
}

/**
 * Safe markdown renderer. Raw HTML is NOT passed through (react-markdown
 * without rehype-raw), so note content cannot inject scripts.
 */
export function MarkdownViewer({ content, wikiMap, className }: MarkdownViewerProps) {
  const resolve = React.useCallback(
    (title: string) => wikiMap?.get(title.trim().toLowerCase()) ?? null,
    [wikiMap],
  );

  const remarkPlugin = React.useMemo(() => remarkWikiLinks(resolve), [resolve]);

  return (
    <div className={cn('markdown-body', className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkPlugin]}
        components={{
          a: ({ href = '', children, ...props }) => {
            if (href.startsWith('kos-wiki:')) {
              const id = href.slice('kos-wiki:'.length);
              return (
                <Link href={`/notes/${id}`} className="wikilink">
                  {children}
                </Link>
              );
            }
            if (href.startsWith('kos-unresolved:')) {
              return (
                <span className="wikilink-unresolved" title="No note with this title yet">
                  {children}
                </span>
              );
            }
            const external = /^https?:\/\//i.test(href);
            return (
              <a
                href={href}
                {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
                {...props}
              >
                {children}
              </a>
            );
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
