import { useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getHourlyForecast, type HourlyForecastResponse } from '../config/api';

const CACHE_PREFIX = 'heatpath_hourly_forecast_cache_';

export function useHourlyForecast(lat: number | null, lon: number | null) {
  const [data, setData] = useState<HourlyForecastResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cacheKey = lat != null && lon != null ? `${CACHE_PREFIX}${lat.toFixed(2)}_${lon.toFixed(2)}` : null;

  const fetchForecast = useCallback(async () => {
    if (lat == null || lon == null) return;
    setLoading(true);
    setError(null);

    // 1. Check local cache
    if (cacheKey) {
      try {
        const cached = await AsyncStorage.getItem(cacheKey);
        if (cached) {
          setData(JSON.parse(cached));
        }
      } catch {}
    }

    // 2. Fetch live data
    try {
      const res = await getHourlyForecast(lat, lon);
      setData(res);
      if (cacheKey && res.status === 'available') {
        await AsyncStorage.setItem(cacheKey, JSON.stringify(res));
      }
    } catch (e: any) {
      setError(e.message || 'Forecast temporarily unavailable');
    } finally {
      setLoading(false);
    }
  }, [lat, lon, cacheKey]);

  useEffect(() => {
    fetchForecast();
  }, [fetchForecast]);

  const isUnavailable = data?.status === 'unavailable';

  return {
    data,
    loading,
    error,
    isUnavailable,
    refetch: fetchForecast,
  };
}
