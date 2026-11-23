'use client';

import * as React from 'react';
import { AlertCircle, ArrowLeft, RefreshCw } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';

/**
 * Route-level error boundary: keeps a render failure on one page from
 * taking down the whole app, and always offers a way back.
 */
export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const router = useRouter();

  React.useEffect(() => {
    // Surface the failure in dev tooling without leaking it to logs in prod.
    console.error('Page error:', error.message, error.digest ?? '');
  }, [error]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 py-16 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-destructive/10">
        <AlertCircle className="h-6 w-6 text-destructive" aria-hidden />
      </div>
      <h1 className="mt-4 text-lg font-semibold">Something went wrong</h1>
      <p className="mt-1 max-w-md text-sm text-muted-foreground">
        This page hit an unexpected error. Your data is safe on this machine — try
        again, or head back home.
      </p>
      {error.message ? (
        <p className="mt-3 max-w-md truncate rounded-md border bg-muted/40 px-3 py-2 font-mono text-xs text-muted-foreground">
          {error.message}
        </p>
      ) : null}
      <div className="mt-6 flex flex-wrap justify-center gap-2">
        <Button onClick={reset}>
          <RefreshCw className="h-4 w-4" aria-hidden /> Try again
        </Button>
        <Button variant="outline" onClick={() => router.push('/')}>
          <ArrowLeft className="h-4 w-4" aria-hidden /> Back to home
        </Button>
      </div>
    </div>
  );
}
