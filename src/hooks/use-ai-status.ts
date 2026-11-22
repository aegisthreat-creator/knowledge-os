'use client';

import * as React from 'react';

export interface AiStatus {
  loading: boolean;
  connected: boolean;
  models: string[];
  error: string | null;
  hint: string | null;
}

const EMPTY: AiStatus = { loading: true, connected: false, models: [], error: null, hint: null };

/**
 * Polls /api/ai/status on mount and whenever the tab regains focus.
 * The status is used by the sidebar indicator and AI screens.
 */
export function useAiStatus(): AiStatus {
  const [status, setStatus] = React.useState<AiStatus>(EMPTY);

  const check = React.useCallback(async () => {
    setStatus((prev) => ({ ...prev, loading: true }));
    try {
      const res = await fetch('/api/ai/status');
      if (!res.ok) throw new Error('status check failed');
      const data: {
        connected: boolean;
        models: { name: string }[];
        error?: string | null;
        hint?: string | null;
      } = await res.json();
      setStatus({
        loading: false,
        connected: data.connected,
        models: data.models.map((m) => m.name),
        error: data.error ?? null,
        hint: data.hint ?? null,
      });
    } catch {
      setStatus({
        loading: false,
        connected: false,
        models: [],
        error: 'Could not check AI status',
        hint: null,
      });
    }
  }, []);

  React.useEffect(() => {
    void check();
    const onFocus = () => void check();
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [check]);

  return status;
}
