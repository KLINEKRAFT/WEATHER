import { useEffect, useState } from 'react';
import {
  fetchAlerts,
  fetchJSON,
  forecastURL,
  parseWeather,
  placeKey,
  readStorage,
  writeStorage,
} from './weather';
import type { Alert, Place, Weather } from './weather';

type ForecastState = {
  key: string;
  data: Weather | null;
  loading: boolean;
  error: string | null;
  updated: number | null;
  cached: boolean;
};
type Cache = { raw: unknown; saved: number };
const REFRESH_MS = 10 * 60 * 1000;

export function useWeather(place: Place, refresh: number) {
  const key = placeKey(place);
  const [state, setState] = useState<ForecastState>({
    key,
    data: null,
    loading: true,
    error: null,
    updated: null,
    cached: false,
  });
  useEffect(() => {
    let disposed = false;
    let request: AbortController | null = null;
    const cached = readStorage<Cache | null>(`forecast:${key}`, null);
    let initial: Weather | null = null;
    if (cached && Date.now() - cached.saved < 24 * 60 * 60 * 1000) {
      try {
        initial = parseWeather(cached.raw);
      } catch {
        /* Ignore corrupt cache. */
      }
    }
    setState({
      key,
      data: initial,
      loading: true,
      error: null,
      updated: initial && cached ? cached.saved : null,
      cached: !!initial,
    });
    async function update() {
      request?.abort();
      request = new AbortController();
      const current = request;
      try {
        const raw = await fetchJSON(forecastURL(place), current.signal);
        const data = parseWeather(raw);
        if (disposed || current.signal.aborted) return;
        const saved = Date.now();
        writeStorage(`forecast:${key}`, { raw, saved });
        setState({ key, data, loading: false, error: null, updated: saved, cached: false });
      } catch (error) {
        if (disposed || current.signal.aborted) return;
        setState((prev) => ({
          ...prev,
          loading: false,
          cached: !!prev.data,
          error: error instanceof Error ? error.message : 'Unable to load the forecast.',
        }));
      }
    }
    void update();
    const timer = window.setInterval(() => {
      if (!document.hidden) void update();
    }, REFRESH_MS);
    const onVisible = () => {
      if (!document.hidden) void update();
    };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('online', onVisible);
    return () => {
      disposed = true;
      request?.abort();
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('online', onVisible);
    };
  }, [key, place, refresh]);
  // A location change must never render the previous location's conditions under the new name.
  return state.key === key
    ? state
    : { key, data: null, loading: true, error: null, updated: null, cached: false };
}

export function useAlerts(place: Place, refresh: number) {
  const key = placeKey(place);
  type State = {
    key: string;
    status: 'loading' | 'ready' | 'unavailable' | 'unsupported';
    alerts: Alert[];
    checked: number | null;
  };
  const [state, setState] = useState<State>({ key, status: 'loading', alerts: [], checked: null });
  useEffect(() => {
    let disposed = false;
    let request: AbortController | null = null;
    if (place.countryCode && place.countryCode !== 'US') {
      setState({ key, status: 'unsupported', alerts: [], checked: null });
      return;
    }
    setState({ key, status: 'loading', alerts: [], checked: null });
    async function update() {
      request?.abort();
      request = new AbortController();
      const current = request;
      try {
        const alerts = await fetchAlerts(place, current.signal);
        if (!disposed && !current.signal.aborted)
          setState({ key, status: 'ready', alerts, checked: Date.now() });
      } catch {
        if (!disposed && !current.signal.aborted)
          setState({ key, status: 'unavailable', alerts: [], checked: null });
      }
    }
    void update();
    const timer = window.setInterval(
      () => {
        if (!document.hidden) void update();
      },
      5 * 60 * 1000,
    );
    const onVisible = () => {
      if (!document.hidden) void update();
    };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('online', onVisible);
    return () => {
      disposed = true;
      request?.abort();
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('online', onVisible);
    };
  }, [key, place, refresh]);
  return state.key === key ? state : { key, status: 'loading' as const, alerts: [], checked: null };
}
