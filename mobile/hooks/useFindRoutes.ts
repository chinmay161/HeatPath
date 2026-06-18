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

export function useFindRoutes(
  startLat: number | null,
  startLon: number | null,
  endLat: number | null,
  endLon: number | null,
): State {
  const [state, setState] = useState<State>({ data: null, loading: false, error: null });

  useEffect(() => {
    if (startLat == null || startLon == null || endLat == null || endLon == null) return;
    let cancelled = false;
    setState({ data: null, loading: true, error: null });

    fetch(`${API_BASE}/find-routes/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        start: { lat: startLat, lon: startLon },
        end:   { lat: endLat,   lon: endLon },
        n_routes: 2,
      }),
    })
      .then(r => {
        if (!r.ok) throw new Error(`Server error ${r.status}`);
        return r.json() as Promise<RoutesResult>;
      })
      .then(data => { if (!cancelled) setState({ data, loading: false, error: null }); })
      .catch((e: Error) => { if (!cancelled) setState({ data: null, loading: false, error: e.message }); });

    return () => { cancelled = true; };
  }, [startLat, startLon, endLat, endLon]);

  return state;
}
