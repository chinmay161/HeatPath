import { useState, useEffect, useCallback } from 'react';
import { apiFetchJson, classifyFailure, type ApiFailureClass } from '../config/api';
import { retryWhileWaking } from '../config/wakeRetry';

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
  /** Why the last load failed, or null on success / while loading. */
  failure: ApiFailureClass | null;
  /** True while retrying because the server is still waking up. */
  waking: boolean;
};

export type CurrentConditionsResult = State & {
  /** Start a fresh load (with its own wake-up retry budget). */
  retry: () => void;
};

const INITIAL_STATE: State = { data: null, loading: false, error: null, failure: null, waking: false };

export function useCurrentConditions(lat: number | null, lon: number | null): CurrentConditionsResult {
  const [state, setState] = useState<State>(INITIAL_STATE);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (lat == null || lon == null) return;
    const controller = new AbortController();
    setState(prev => ({ ...prev, loading: true, error: null, failure: null, waking: false }));

    retryWhileWaking(
      timeoutMs => apiFetchJson<Conditions>(`/conditions/?lat=${lat}&lon=${lon}`, {
        signal: controller.signal,
        timeoutMs,
      }),
      {
        signal: controller.signal,
        onWaking: () => {
          if (!controller.signal.aborted) setState(prev => ({ ...prev, waking: true }));
        },
      },
    )
      .then(data => {
        if (!controller.signal.aborted) {
          setState({ data, loading: false, error: null, failure: null, waking: false });
        }
      })
      .catch((e: Error) => {
        if (controller.signal.aborted || e?.name === 'AbortError') return;
        setState({
          data: null,
          loading: false,
          error: e?.message || 'Request failed',
          failure: classifyFailure(e),
          waking: false,
        });
      });

    return () => controller.abort();
  }, [lat, lon, attempt]);

  const retry = useCallback(() => setAttempt(n => n + 1), []);

  return { ...state, retry };
}
