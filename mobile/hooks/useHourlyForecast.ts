import { useState, useEffect, useCallback, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  apiFetchJson,
  classifyFailure,
  type ApiFailureClass,
  type HourlyForecastResponse,
} from '../config/api';
import { retryWhileWaking } from '../config/wakeRetry';
import { freshenCachedForecast, parseForecastCache, serializeForecastCache } from '../utils/forecastStatus';

const CACHE_PREFIX = 'heatpath_hourly_forecast_cache_';

export function useHourlyForecast(lat: number | null, lon: number | null) {
  const [data, setData] = useState<HourlyForecastResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** Why the last live load failed, or null. */
  const [failure, setFailure] = useState<ApiFailureClass | null>(null);
  /** True while retrying because the server is still waking up. */
  const [waking, setWaking] = useState(false);
  /** When `data` came from the cache rather than a live load, the time it was fetched. */
  const [cachedAt, setCachedAt] = useState<Date | null>(null);
  const [isCached, setIsCached] = useState(false);
  const controllerRef = useRef<AbortController | null>(null);

  const cacheKey = lat != null && lon != null ? `${CACHE_PREFIX}${lat.toFixed(2)}_${lon.toFixed(2)}` : null;

  const fetchForecast = useCallback(async () => {
    if (lat == null || lon == null) return;
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    const { signal } = controller;

    setLoading(true);
    setError(null);
    setFailure(null);
    setWaking(false);

    // The saved forecast trimmed to the hours still ahead, or null if too stale to show
    const loadFreshCache = async () => {
      if (!cacheKey) return null;
      try {
        const cached = parseForecastCache(await AsyncStorage.getItem(cacheKey));
        const fresh = cached && freshenCachedForecast(cached, new Date());
        return fresh ? { data: fresh, savedAt: cached!.savedAt } : null;
      } catch {
        return null;
      }
    };

    // 1. Show the last good forecast while the live one loads
    const initial = await loadFreshCache();
    if (initial && !signal.aborted) {
      setData(initial.data);
      setCachedAt(initial.savedAt);
      setIsCached(true);
    }

    // 2. Fetch live data, retrying while the server wakes
    try {
      const res = await retryWhileWaking(
        timeoutMs => apiFetchJson<HourlyForecastResponse>(`/forecast/hourly?lat=${lat}&lon=${lon}`, {
          signal,
          timeoutMs,
        }),
        { signal, onWaking: () => { if (!signal.aborted) setWaking(true); } },
      );
      if (signal.aborted) return;
      setData(res);
      setIsCached(false);
      setCachedAt(null);
      if (cacheKey) {
        try {
          await AsyncStorage.setItem(cacheKey, serializeForecastCache(res, new Date()));
        } catch {}
      }
    } catch (e: any) {
      if (signal.aborted || e?.name === 'AbortError') return;
      // Show the saved forecast if it is still fresh enough, otherwise the failure state.
      // Re-read it so an earlier live result left on screen is held to the same rules.
      const saved = await loadFreshCache();
      if (signal.aborted) return;
      setData(saved?.data ?? null);
      setCachedAt(saved?.savedAt ?? null);
      setIsCached(saved != null);
      setFailure(classifyFailure(e));
      setError(e?.message || 'Forecast temporarily unavailable');
    } finally {
      if (!signal.aborted) {
        setLoading(false);
        setWaking(false);
      }
    }
  }, [lat, lon, cacheKey]);

  useEffect(() => {
    fetchForecast();
    return () => controllerRef.current?.abort();
  }, [fetchForecast]);

  return {
    data,
    loading,
    error,
    failure,
    waking,
    isCached,
    cachedAt,
    refetch: fetchForecast,
  };
}
