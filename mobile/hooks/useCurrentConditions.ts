import { useState, useEffect } from 'react';
import { API_BASE } from '../config/api';

export type Severity = 'SAFE' | 'CAUTION' | 'HIGH' | 'EXTREME';

export type Conditions = {
  status?: string;
  provider?: string;
  provider_status?: string;
  retry_after?: number;
  observed_at?: string;
  age_seconds?: number;
  heat_index: number | null;
  shade_index: number | null;
  aqi_index: number | null;
  temperature_c: number | null;
  humidity_pct: number | null;
  feels_like_c: number | null;
  severity: Severity | null;
  weather?: any;
  aqi?: {
    value: number | null;
    status: string;
    provider: string;
  };
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
    setState(prev => ({ ...prev, loading: true, error: null }));

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
