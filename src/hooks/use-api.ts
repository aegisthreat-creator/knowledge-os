'use client';

import * as React from 'react';

interface UseApiOptions<T> {
  /** Skip fetching until this is true (default true). */
  enabled?: boolean;
  /** Map the raw JSON response into the shape the component needs. */
  map?: (raw: unknown) => T;
}

interface UseApiResult<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  refresh: () => void;
  setData: React.Dispatch<React.SetStateAction<T | null>>;
}

/**
 * Minimal fetch wrapper with loading/error state and manual refresh.
 * Kept intentionally small — no external data-fetching dependency.
 */
export function useApi<T>(url: string | null, options?: UseApiOptions<T>): UseApiResult<T> {
  const { enabled = true, map } = options ?? {};
  const [data, setData] = React.useState<T | null>(null);
  const [loading, setLoading] = React.useState<boolean>(enabled && url !== null);
  const [error, setError] = React.useState<string | null>(null);
  const [tick, setTick] = React.useState(0);

  React.useEffect(() => {
    if (!enabled || url === null) {
      setLoading(false);
      return;
    }
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const res = await fetch(url, { signal: controller.signal });
        if (!res.ok) {
          const body = (await res.json().catch(() => null)) as { error?: string } | null;
          throw new Error(body?.error ?? `Request failed (${res.status})`);
        }
        const json: unknown = await res.json();
        setData(map ? map(json) : (json as T));
      } catch (err) {
        if (controller.signal.aborted) return;
        setError(err instanceof Error ? err.message : 'Request failed');
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    })();
    return () => controller.abort();
    // `map` is intentionally not a dependency: callers should pass a stable function.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url, enabled, tick]);

  const refresh = React.useCallback(() => setTick((t) => t + 1), []);

  return { data, loading, error, refresh, setData };
}
