'use client';

import * as React from 'react';
import { Bot, Menu, Search, X } from 'lucide-react';
import { Sidebar } from './sidebar';
import { ThemeToggle } from './theme-toggle';
import { QuickSearch, useQuickSearchHotkey } from './quick-search';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useAiStatus } from '@/hooks/use-ai-status';

export function AppShell({ children }: { children: React.ReactNode }) {
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);
  const [quickSearchOpen, setQuickSearchOpen] = React.useState(false);
  const aiStatus = useAiStatus();

  useQuickSearchHotkey(() => setQuickSearchOpen(true));

  // Close the mobile drawer whenever the route changes.
  const pathname = typeof window !== 'undefined' ? window.location.pathname : '';
  React.useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  return (
    <div className="flex min-h-screen">
      <div className="sticky top-0 hidden h-screen md:block">
        <Sidebar onOpenQuickSearch={() => setQuickSearchOpen(true)} />
      </div>

      {/* Mobile header */}
      <header className="sticky top-0 z-40 flex h-14 w-full items-center gap-2 border-b bg-background/95 px-3 backdrop-blur md:hidden">
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => setMobileMenuOpen(true)}
          aria-label="Open menu"
        >
          <Menu className="h-5 w-5" />
        </Button>
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-md bg-primary text-xs font-bold text-primary-foreground">
            K
          </span>
          <span className="text-sm font-semibold">KnowledgeOS</span>
        </div>
        <div className="ml-auto flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => setQuickSearchOpen(true)}
            aria-label="Search"
          >
            <Search className="h-4 w-4" />
          </Button>
          <a
            href="/assistant"
            className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-accent focus-ring"
            aria-label="AI assistant"
          >
            <Bot className="h-4 w-4" />
            <span
              className={cn(
                'absolute mt-[-14px] ml-[-14px] h-1.5 w-1.5 rounded-full',
                aiStatus.connected ? 'bg-success' : 'bg-destructive/70',
              )}
              aria-hidden
            />
          </a>
          <ThemeToggle />
        </div>
      </header>

      {/* Mobile drawer */}
      {mobileMenuOpen ? (
        <div className="fixed inset-0 z-50 md:hidden" role="dialog" aria-modal="true" aria-label="Navigation menu">
          <div
            className="absolute inset-0 bg-black/45 animate-fade-in"
            onClick={() => setMobileMenuOpen(false)}
          />
          <div className="absolute inset-y-0 left-0 w-64 animate-fade-in-up bg-sidebar shadow-2xl">
            <Button
              variant="ghost"
              size="icon-sm"
              className="absolute right-2 top-4"
              onClick={() => setMobileMenuOpen(false)}
              aria-label="Close menu"
            >
              <X className="h-4 w-4" />
            </Button>
            <Sidebar
              onNavigate={() => setMobileMenuOpen(false)}
              onOpenQuickSearch={() => {
                setMobileMenuOpen(false);
                setQuickSearchOpen(true);
              }}
            />
          </div>
        </div>
      ) : null}

      <main className="min-w-0 flex-1">{children}</main>

      <QuickSearch open={quickSearchOpen} onOpenChange={setQuickSearchOpen} />
    </div>
  );
}
