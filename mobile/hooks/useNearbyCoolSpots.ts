import { useState, useEffect, useCallback } from 'react';
import { getCoolSpots } from '../config/api';

export type CoolSpot = {
  id: string;
  name: string;
  lat: number;
  lon: number;
  distanceM: number;
  distance_m: number;
  walkMin: number;
  walk_min: number;
  icon: 'shade' | 'ac' | 'water';
  tone: 'green' | 'blue';
  badge: 'DEEP SHADE' | 'A/C REFUGE' | 'WATER';
  category: 'shade' | 'ac' | 'water';
};

type State = {
  spots: CoolSpot[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
};

export function useNearbyCoolSpots(
  lat: number | null,
  lon: number | null,
  radiusM = 1500,
  category = 'all',
): State {
  const [spots, setSpots] = useState<CoolSpot[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const fetchSpots = useCallback(async () => {
    if (lat == null || lon == null) return;
    setLoading(true);
    setError(null);
    try {
      const res = await getCoolSpots(lat, lon, radiusM, category);
      const transformed: CoolSpot[] = res.spots.map(s => ({
        id: s.id,
        name: s.name,
        lat: s.lat,
        lon: s.lon,
        distanceM: s.distance_m,
        distance_m: s.distance_m,
        walkMin: s.walk_min,
        walk_min: s.walk_min,
        icon: s.icon,
        tone: s.tone,
        badge: s.badge,
        category: s.category,
      }));
      setSpots(transformed);
    } catch (err: any) {
      setError(err?.message || 'Failed to fetch cool spots');
    } finally {
      setLoading(false);
    }
  }, [lat, lon, radiusM, category]);

  useEffect(() => {
    fetchSpots();
  }, [fetchSpots]);

  return { spots, loading, error, refresh: fetchSpots };
}
