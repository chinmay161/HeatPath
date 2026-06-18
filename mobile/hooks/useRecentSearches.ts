import AsyncStorage from '@react-native-async-storage/async-storage';
import { useState, useEffect, useCallback } from 'react';

const KEY = 'heatpath_recent_searches';
const MAX = 3;

export type RecentSearch = {
  id: string;
  name: string;
  lat: number;
  lon: number;
  timestamp: number;
};

export function useRecentSearches() {
  const [recents, setRecents] = useState<RecentSearch[]>([]);

  useEffect(() => {
    AsyncStorage.getItem(KEY).then(raw => {
      if (raw) {
        try { setRecents(JSON.parse(raw)); } catch {}
      }
    });
  }, []);

  const addRecent = useCallback((name: string, lat: number, lon: number) => {
    const entry: RecentSearch = { id: String(Date.now()), name, lat, lon, timestamp: Date.now() };
    setRecents(prev => {
      const deduped = prev.filter(r => r.name.toLowerCase() !== name.toLowerCase());
      const updated = [entry, ...deduped].slice(0, MAX);
      AsyncStorage.setItem(KEY, JSON.stringify(updated)).catch(() => {});
      return updated;
    });
  }, []);

  return { recents, addRecent };
}
