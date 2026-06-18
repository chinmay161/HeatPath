import { useState, useEffect } from 'react';
import { API_BASE } from '../config/api';

export type Severity = 'SAFE' | 'CAUTION' | 'HIGH' | 'EXTREME';

export type Conditions = {
  heat_index: number;
  shade_index: number;
  aqi_index: number;
  temperature_c: number;
  humidity_pct: number;
  feels_like_c: number;
  severity: Severity;
};

type State = {
  data: Conditions | null;
  loading: boolean;
  error: string | null;
};

export function useCurrentConditions(lat: number | null, lon: number | null): State {
  const [state, setState] = useState<State>({ data: null, loading: false, error: null });

  useEffect(() => {
    if (lat == null || lon == null) return;
    let cancelled = false;
    setState({ data: null, loading: true, error: null });

    fetch(`${API_BASE}/conditions/?lat=${lat}&lon=${lon}`)
      .then(r => {
        if (!r.ok) throw new Error(`Server error ${r.status}`);
        return r.json() as Promise<Conditions>;
      })
      .then(data => { if (!cancelled) setState({ data, loading: false, error: null }); })
      .catch((e: Error) => { if (!cancelled) setState({ data: null, loading: false, error: e.message }); });

    return () => { cancelled = true; };
  }, [lat, lon]);

  return state;
}
