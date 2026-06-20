import { useState, useEffect } from 'react';
import { API_BASE } from '../config/api';

export type ScoredRoute = {
  rank: number;
  overall_score: number;
  shade_safety_score: number;
  heat_safety_score: number;
  crowd_safety_score: number;
  avg_shade_pct: number;
  feels_like_c: number;
  shade_segments: number[];
  segment_distances_m: number[];
  path: { lat: number; lon: number }[];
  segment_count: number;
};

export type RoutesResult = {
  routes: ScoredRoute[];
  conditions: {
    heat_index: number;
    aqi_normalised: number;
    fetched_at_lat: number;
    fetched_at_lon: number;
  };
};

type State = {
  data: RoutesResult | null;
  loading: boolean;
  error: string | null;
};

const cachedRoutes = new Map<string, RoutesResult>();

export async function findRoutes(
  startLat: number,
  startLon: number,
  endLat: number,
  endLon: number,
  signal?: AbortSignal,
): Promise<RoutesResult> {
  const response = await fetch(`${API_BASE}/find-routes/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    signal,
    body: JSON.stringify({
      start: { lat: startLat, lon: startLon },
      end:   { lat: endLat,   lon: endLon },
      n_routes: 2,
    }),
  });

  if (!response.ok) throw new Error(`Server error ${response.status}`);
  return response.json() as Promise<RoutesResult>;
}

export function cacheRoutesResult(data: RoutesResult): string {
  const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  cachedRoutes.set(id, data);
  return id;
}

export function getCachedRoutesResult(id: string | null | undefined): RoutesResult | null {
  if (!id) return null;
  return cachedRoutes.get(id) ?? null;
}

export function useFindRoutes(
  startLat: number | null,
  startLon: number | null,
  endLat: number | null,
  endLon: number | null,
  enabled = true,
): State {
  const [state, setState] = useState<State>({ data: null, loading: false, error: null });

  useEffect(() => {
    if (!enabled || startLat == null || startLon == null || endLat == null || endLon == null) return;
    let cancelled = false;
    const controller = new AbortController();
    setState({ data: null, loading: true, error: null });

    findRoutes(startLat, startLon, endLat, endLon, controller.signal)
      .then(data => { if (!cancelled) setState({ data, loading: false, error: null }); })
      .catch((e: Error) => {
        if (!cancelled && e.name !== 'AbortError') {
          setState({ data: null, loading: false, error: e.message });
        }
      });

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [startLat, startLon, endLat, endLon, enabled]);

  return state;
}
