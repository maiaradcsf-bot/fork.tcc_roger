import { useCallback, useEffect, useRef, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';

import { useAuth } from '../context/AuthContext.js';

export function useLoader(loader, { reloadOnFocus = true } = {}) {
  const { handleError } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const loaderRef = useRef(loader);
  loaderRef.current = loader;

  const run = useCallback(
    async (mode = 'load') => {
      if (mode === 'refresh') setRefreshing(true);
      else setLoading(true);
      try {
        const result = await loaderRef.current();
        setData(result);
        setError(null);
        return result;
      } catch (err) {
        setError(err);
        if (err?.isUnauthorized) handleError(err);
        return null;
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [handleError],
  );

  useFocusEffect(
    useCallback(() => {
      if (reloadOnFocus) run('load');
    }, [run, reloadOnFocus]),
  );

  useEffect(() => {
    if (!reloadOnFocus) run('load');
  }, [run, reloadOnFocus]);

  return { data, setData, loading, refreshing, error, reload: () => run('load'), refresh: () => run('refresh') };
}

export function useAction() {
  const { handleError } = useAuth();
  const [busy, setBusy] = useState(false);

  const run = useCallback(
    async (action, { onError } = {}) => {
      setBusy(true);
      try {
        return await action();
      } catch (error) {
        if (onError && onError(error)) return undefined;
        handleError(error);
        return undefined;
      } finally {
        setBusy(false);
      }
    },
    [handleError],
  );

  return { busy, run };
}
