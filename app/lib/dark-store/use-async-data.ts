import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Tiny async loader for browser → dark-store-api calls.
 * Re-runs when `key` changes; `loader` is read from a ref so callers
 * don't need to memoize the function.
 */
export function useAsyncData<T>(
  key: string,
  loader: () => Promise<T>,
  enabled = true,
) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(enabled);
  const loaderRef = useRef(loader);
  loaderRef.current = loader;

  const reload = useCallback(async () => {
    if (!enabled) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const result = await loaderRef.current();
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [enabled, key]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { data, error, loading, reload };
}

/** Stable key fragment so loaders re-run when partner JWT rotates. */
export function darkStoreSessionKey(
  ds: { configured: false } | { configured: true; token: string },
) {
  return ds.configured ? ds.token.slice(-24) : "offline";
}
