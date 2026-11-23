'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Bot, Circle, Command, Search } from 'lucide-react';
import { NAV_GROUPS } from './nav';
import { ThemeToggle } from './theme-toggle';
import { Kbd } from '@/components/ui/kbd';
import { cn } from '@/lib/utils';
import { useAiStatus } from '@/hooks/use-ai-status';

interface SidebarProps {
  className?: string;
  onNavigate?: () => void;
  onOpenQuickSearch?: () => void;
}

export function Sidebar({ className, onNavigate, onOpenQuickSearch }: SidebarProps) {
  const pathname = usePathname();
  const aiStatus = useAiStatus();

  return (
    <aside
      className={cn(
        'flex h-screen w-60 shrink-0 flex-col border-r border-sidebar-border bg-sidebar',
        className,
      )}
    >
      <div className="flex items-center gap-2.5 px-4 pb-4 pt-5">
        <Link
          href="/"
          onClick={onNavigate}
          className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-sm font-bold text-primary-foreground shadow-sm focus-ring"
          aria-label="KnowledgeOS home"
        >
          K
        </Link>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold leading-tight">KnowledgeOS</p>
          <p className="truncate text-[11px] leading-tight text-muted-foreground">
            Your knowledge. Your machine.
          </p>
        </div>
      </div>

      <div className="px-3 pb-2">
        <button
          type="button"
          onClick={onOpenQuickSearch}
          className="flex w-full items-center gap-2 rounded-md border border-sidebar-border bg-background px-2.5 py-1.5 text-left text-sm text-muted-foreground shadow-sm transition-colors hover:bg-accent focus-ring"
        >
          <Search className="h-3.5 w-3.5" aria-hidden />
          <span className="flex-1">Search</span>
          <Kbd className="hidden lg:flex">
            <Command className="h-2.5 w-2.5" /> K
          </Kbd>
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 pb-3" aria-label="Main navigation">
        {NAV_GROUPS.map((group, gi) => (
          <div key={group.label ?? gi} className={cn('pb-1', gi > 0 && 'pt-3')}>
            {group.label ? (
              <p className="px-2 pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/80">
                {group.label}
              </p>
            ) : null}
            <ul className="space-y-0.5">
              {group.items.map((item) => {
                const active =
                  item.href === '/' ? pathname === '/' : pathname.startsWith(item.href);
                const Icon = item.icon;
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={onNavigate}
                      aria-current={active ? 'page' : undefined}
                      className={cn(
                        'flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm font-medium transition-colors focus-ring',
                        active
                          ? 'bg-sidebar-accent text-sidebar-foreground shadow-sm'
                          : 'text-muted-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-foreground',
                      )}
                    >
                      <Icon className={cn('h-4 w-4', active && 'text-primary')} aria-hidden />
                      {item.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className="border-t border-sidebar-border px-3 py-3">
        <Link
          href="/assistant"
          onClick={onNavigate}
          className="mb-2 flex items-center gap-2 rounded-md px-2 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground focus-ring"
        >
          <Bot className="h-3.5 w-3.5" aria-hidden />
          <span className="flex-1">Local AI</span>
          <Circle
            className={cn(
              'h-2 w-2 fill-current',
              aiStatus.loading
                ? 'text-muted-foreground/50'
                : aiStatus.connected
                  ? 'text-success'
                  : 'text-destructive/80',
            )}
            aria-hidden
          />
          <span className="sr-only">
            {aiStatus.loading
              ? 'checking'
              : aiStatus.connected
                ? 'Ollama connected'
                : 'Ollama offline'}
          </span>
        </Link>
        <div className="flex items-center justify-between px-1">
          <span className="text-[11px] text-muted-foreground/70">v0.1.0 · local-first</span>
          <ThemeToggle />
        </div>
      </div>
    </aside>
  );
}
