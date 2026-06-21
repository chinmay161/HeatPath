import AsyncStorage from '@react-native-async-storage/async-storage';
import { useState, useEffect, useCallback } from 'react';

const KEY = 'heatpath_walk_history';

export type WalkRecord = {
  id: string;
  timestamp: number;
  routeTitle: string;
  destName: string;
  distanceM: number;
  feelLikeC: number;
  shadePct: number;
  overallScore: number;
  heatHoursAvoided: number;
};

export type WalkStats = {
  totalWalks: number;
  streak: number;
  totalHeatHoursAvoided: number;
  last8DaysAvoided: number[];
  last8DaysWalks: number[];
};

function dayKey(ts: number): string {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function computeStreak(walks: WalkRecord[]): number {
  if (walks.length === 0) return 0;
  const days = new Set(walks.map(w => dayKey(w.timestamp)));
  const todayKey = dayKey(Date.now());

  // If no walk today, count from yesterday (today hasn't broken streak yet)
  const startOffset = days.has(todayKey) ? 0 : 1;

  const anchor = new Date();
  anchor.setDate(anchor.getDate() - startOffset);
  if (!days.has(dayKey(anchor.getTime()))) return 0;

  let streak = 0;
  for (let i = startOffset; i < 366; i++) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    if (days.has(dayKey(d.getTime()))) {
      streak++;
    } else {
      break;
    }
  }
  return streak;
}

function computeStats(walks: WalkRecord[]): WalkStats {
  const totalWalks = walks.length;
  const totalHeatHoursAvoided = walks.reduce((sum, w) => sum + w.heatHoursAvoided, 0);
  const streak = computeStreak(walks);

  // last8DaysAvoided[0] = 7 days ago, last8DaysAvoided[7] = today
  const last8DaysAvoided: number[] = Array.from({ length: 8 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (7 - i));
    const k = dayKey(d.getTime());
    return walks
      .filter(w => dayKey(w.timestamp) === k)
      .reduce((sum, w) => sum + w.heatHoursAvoided, 0);
  });

  const last8DaysWalks: number[] = Array.from({ length: 8 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (7 - i));
    const k = dayKey(d.getTime());
    return walks.filter(w => dayKey(w.timestamp) === k).length;
  });

  return { totalWalks, streak, totalHeatHoursAvoided, last8DaysAvoided, last8DaysWalks };
}

export function useWalkHistory() {
  const [walks, setWalks] = useState<WalkRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    AsyncStorage.getItem(KEY).then(raw => {
      if (raw) {
        try { setWalks(JSON.parse(raw)); } catch {}
      }
      setLoading(false);
    });
  }, []);

  const recordWalk = useCallback((walk: Omit<WalkRecord, 'id' | 'timestamp'>) => {
    const record: WalkRecord = {
      id: String(Date.now()) + '_' + Math.random().toString(36).slice(2),
      timestamp: Date.now(),
      ...walk,
    };
    setWalks(prev => {
      const updated = [...prev, record];
      AsyncStorage.setItem(KEY, JSON.stringify(updated)).catch(() => {});
      return updated;
    });
  }, []);

  return { walks, stats: computeStats(walks), recordWalk, loading };
}
