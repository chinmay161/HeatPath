import { useState, useEffect } from 'react';

export type PlaceSuggestion = {
  id: string;
  name: string;
  secondary: string;
  lat: number;
  lon: number;
};

function formatSuggestion(feature: any): PlaceSuggestion {
  const p = feature.properties ?? {};
  const [lon, lat] = feature.geometry?.coordinates ?? [0, 0];

  // Primary name — fall back through street, county, city for address-only results
  const name = p.name || p.street || p.county || p.city || 'Unknown place';

  // Secondary line: city/town/village + state, skipping anything equal to name
  const secondary = [
    p.city || p.town || p.village,
    p.state,
  ]
    .filter(Boolean)
    .filter((s: string) => s !== name)
    .slice(0, 2)
    .join(', ');

  return {
    id: `${p.osm_type ?? 'x'}${p.osm_id ?? Math.random()}`,
    name,
    secondary,
    lat,
    lon,
  };
}

type State = {
  results: PlaceSuggestion[];
  loading: boolean;
  error: string | null;
};

export function usePhotonSearch(
  query: string,
  biasLat?: number | null,
  biasLon?: number | null,
): State {
  const [state, setState] = useState<State>({ results: [], loading: false, error: null });

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setState({ results: [], loading: false, error: null });
      return;
    }

    let cancelled = false;

    // 300 ms debounce
    const timer = setTimeout(async () => {
      if (cancelled) return;
      setState(s => ({ ...s, loading: true, error: null }));

      try {
        let url = `https://photon.komoot.io/api/?q=${encodeURIComponent(q)}&limit=6`;
        if (biasLat != null && biasLon != null) {
          url += `&lat=${biasLat}&lon=${biasLon}`;
        }
        const r = await fetch(url, { headers: { Accept: 'application/json' } });
        if (!r.ok) throw new Error(`Photon returned ${r.status}`);
        const data = await r.json();
        if (!cancelled) {
          setState({
            results: (data.features ?? []).map(formatSuggestion),
            loading: false,
            error: null,
          });
        }
      } catch (e: any) {
        if (!cancelled) setState({ results: [], loading: false, error: e?.message ?? 'Search failed' });
      }
    }, 300);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query, biasLat, biasLon]);

  return state;
}
