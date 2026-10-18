import { useCallback, useEffect, useState } from 'react';
import { api } from '../services/api';

export function useApi(path, initial = []) {
  const [fallback] = useState(() => initial);
  const [state, setState] = useState({ path, data: initial, loading: Boolean(path), error: '' });
  const reload = useCallback(async () => {
    if (!path) return;
    setState((previous) => ({ ...previous, path, loading: true }));
    try {
      const data = await api(path);
      setState({ path, data, loading: false, error: '' });
      return data;
    } catch (error) {
      setState((previous) => ({ ...previous, path, loading: false, error: error.message }));
      throw error;
    }
  }, [path]);
  useEffect(() => {
    if (!path) return;
    const controller = new AbortController();
    api(path, { signal: controller.signal }).then((data) => {
      if (!controller.signal.aborted) setState({ path, data, loading: false, error: '' });
    }).catch((error) => {
      if (error.name !== 'AbortError') setState({ path, data: fallback, loading: false, error: error.message });
    });
    return () => controller.abort();
  }, [path, fallback]);
  const setData = useCallback((value) => setState((previous) => ({ ...previous, path, data: typeof value === 'function' ? value(previous.data) : value })), [path]);
  const current = state.path === path ? state : { data: fallback, loading: Boolean(path), error: '' };
  return { ...current, setData, reload };
}
