import { useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  getPreferences,
  updatePreferences as apiUpdatePreferences,
  type UserPreferences,
  type FavoriteRoute,
} from '../config/api';

const PREFERENCES_KEY = 'heatpath_user_preferences_cache';

export const DEFAULT_PREFERENCES: UserPreferences = {
  heat_sensitivity: 5,
  aqi_sensitivity: 5,
  avoid_crowds: false,
  walking_speed: 'normal',
  accessibility: 'none',
  units: 'celsius',
  theme: 'system',
  favorite_routes: [],
};

type Listener = (prefs: UserPreferences) => void;
const listeners = new Set<Listener>();

let memoryPreferences: UserPreferences | null = null;

function broadcast(prefs: UserPreferences) {
  memoryPreferences = prefs;
  listeners.forEach(fn => fn(prefs));
}

export function usePreferences() {
  const [preferences, setPreferences] = useState<UserPreferences>(memoryPreferences || DEFAULT_PREFERENCES);
  const [loading, setLoading] = useState<boolean>(!memoryPreferences);
  const [saving, setSaving] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const listener: Listener = (newPrefs) => {
      setPreferences(newPrefs);
    };
    listeners.add(listener);

    // 1. Instant load from local storage
    AsyncStorage.getItem(PREFERENCES_KEY)
      .then((raw) => {
        if (raw) {
          try {
            const parsed = JSON.parse(raw);
            setPreferences(parsed);
            memoryPreferences = parsed;
          } catch {}
        }
      })
      .finally(() => {
        // 2. Refresh from backend
        getPreferences()
          .then((remote) => {
            setPreferences(remote);
            broadcast(remote);
            AsyncStorage.setItem(PREFERENCES_KEY, JSON.stringify(remote)).catch(() => {});
            setError(null);
          })
          .catch((err) => {
            if (!memoryPreferences) {
              setError(err.message || 'Could not load preferences');
            }
          })
          .finally(() => setLoading(false));
      });

    return () => {
      listeners.delete(listener);
    };
  }, []);

  const savePreferences = useCallback(async (updates: Partial<UserPreferences>) => {
    setSaving(true);
    setError(null);
    try {
      const merged = { ...preferences, ...updates };
      // Optimistic update
      setPreferences(merged);
      broadcast(merged);
      await AsyncStorage.setItem(PREFERENCES_KEY, JSON.stringify(merged));

      const updated = await apiUpdatePreferences(merged);
      setPreferences(updated);
      broadcast(updated);
      await AsyncStorage.setItem(PREFERENCES_KEY, JSON.stringify(updated));
      return updated;
    } catch (e: any) {
      setError(e.message || 'Failed to update preferences');
      throw e;
    } finally {
      setSaving(false);
    }
  }, [preferences]);

  const addFavoriteRoute = useCallback(async (route: Omit<FavoriteRoute, 'id'>) => {
    const newEntry: FavoriteRoute = {
      ...route,
      id: String(Date.now()) + '_' + Math.random().toString(36).substring(2, 7),
      created_at: new Date().toISOString(),
    };
    const currentList = preferences.favorite_routes || [];
    const deduped = currentList.filter(r => r.name.toLowerCase() !== route.name.toLowerCase());
    const updatedList = [newEntry, ...deduped].slice(0, 10);
    await savePreferences({ favorite_routes: updatedList });
    return newEntry;
  }, [preferences, savePreferences]);

  const removeFavoriteRoute = useCallback(async (id: string) => {
    const updatedList = (preferences.favorite_routes || []).filter(r => r.id !== id);
    await savePreferences({ favorite_routes: updatedList });
  }, [preferences, savePreferences]);

  const formatTemp = useCallback((tempC: number | null | undefined): string => {
    if (tempC == null) return '—';
    if (preferences.units === 'fahrenheit') {
      const f = Math.round((tempC * 9) / 5 + 32);
      return `${f}°F`;
    }
    return `${Math.round(tempC)}°C`;
  }, [preferences.units]);

  return {
    preferences,
    loading,
    saving,
    error,
    savePreferences,
    addFavoriteRoute,
    removeFavoriteRoute,
    formatTemp,
  };
}
