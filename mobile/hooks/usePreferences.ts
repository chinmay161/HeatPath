import { useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  getPreferences,
  updatePreferences as apiUpdatePreferences,
  type UserPreferences,
  type FavoriteRoute,
} from '../config/api';

import { identityProvider } from '../services/identity';

const PREFERENCES_KEY_BASE = 'heatpath_user_preferences_cache';

async function getStorageKey(): Promise<string> {
  try {
    const userId = await identityProvider.getUserId();
    return `${PREFERENCES_KEY_BASE}_${userId}`;
  } catch {
    return PREFERENCES_KEY_BASE;
  }
}

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
    getStorageKey().then((storageKey) => {
      AsyncStorage.getItem(storageKey)
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
              const currentUnits = memoryPreferences?.units;
              const finalPrefs = (currentUnits && remote.units === 'celsius' && currentUnits !== 'celsius')
                ? { ...remote, units: currentUnits }
                : remote;
              setPreferences(finalPrefs);
              broadcast(finalPrefs);
              AsyncStorage.setItem(storageKey, JSON.stringify(finalPrefs)).catch(() => {});
              setError(null);
            })
            .catch((err) => {
              if (!memoryPreferences) {
                setError(err.message || 'Could not load preferences');
              }
            })
            .finally(() => setLoading(false));
        });
    });

    return () => {
      listeners.delete(listener);
    };
  }, []);

  const savePreferences = useCallback(async (updates: Partial<UserPreferences>) => {
    setSaving(true);
    setError(null);
    const merged = { ...preferences, ...updates };
    setPreferences(merged);
    broadcast(merged);
    const storageKey = await getStorageKey();
    await AsyncStorage.setItem(storageKey, JSON.stringify(merged)).catch(() => {});

    try {
      const updated = await apiUpdatePreferences(merged);
      if (updated) {
        setPreferences(updated);
        broadcast(updated);
        await AsyncStorage.setItem(storageKey, JSON.stringify(updated)).catch(() => {});
        return updated;
      }
      return merged;
    } catch (e: any) {
      console.warn('[usePreferences] Backend sync failed, keeping local preference:', e?.message);
      return merged;
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

  const isFahrenheit = preferences.units === 'fahrenheit';
  const unitSymbol = isFahrenheit ? '°F' : '°C';

  const convertTemp = useCallback((tempC: number | null | undefined): number | null => {
    if (tempC == null) return null;
    if (preferences.units === 'fahrenheit') {
      return Math.round((tempC * 9) / 5 + 32);
    }
    return Math.round(tempC);
  }, [preferences.units]);

  const formatTemp = useCallback((tempC: number | null | undefined, options?: { includeUnit?: boolean }): string => {
    if (tempC == null) return '—';
    const isF = preferences.units === 'fahrenheit';
    const val = isF ? Math.round((tempC * 9) / 5 + 32) : Math.round(tempC);
    if (options?.includeUnit === false) {
      return `${val}°`;
    }
    return `${val}°${isF ? 'F' : 'C'}`;
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
    convertTemp,
    isFahrenheit,
    unitSymbol,
  };
}
