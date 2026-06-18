import { useState, useEffect } from 'react';

export type CoolSpot = {
  id: string;
  name: string;
  lat: number;
  lon: number;
  distanceM: number;
  walkMin: number;
  icon: 'shade' | 'ac' | 'water';
  tone: 'green' | 'blue';
  badge: 'DEEP SHADE' | 'A/C REFUGE' | 'WATER';
};

type State = {
  spots: CoolSpot[];
  loading: boolean;
  error: string | null;
};

function haversineM(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(Δφ / 2) ** 2 +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

type OverpassEl = {
  type: string;
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags: Record<string, string>;
};

function classify(tags: Record<string, string>): Pick<CoolSpot, 'icon' | 'tone' | 'badge'> | null {
  if (tags.leisure === 'park')
    return { icon: 'shade', tone: 'green', badge: 'DEEP SHADE' };
  if (tags.shop === 'mall' || tags.shop === 'department_store')
    return { icon: 'ac', tone: 'blue', badge: 'A/C REFUGE' };
  if (tags.amenity === 'cinema' || tags.amenity === 'library')
    return { icon: 'ac', tone: 'blue', badge: 'A/C REFUGE' };
  if (
    tags.amenity === 'drinking_water' ||
    tags.amenity === 'water_point' ||
    tags.amenity === 'fountain'
  )
    return { icon: 'water', tone: 'blue', badge: 'WATER' };
  return null;
}

// Fallback name for unnamed water features so they still appear in results
function resolveName(tags: Record<string, string>): string | null {
  if (tags.name || tags['name:en']) return tags.name || tags['name:en'];
  if (tags.amenity === 'drinking_water') return 'Drinking Water';
  if (tags.amenity === 'water_point') return 'Water Point';
  if (tags.amenity === 'fountain') return 'Fountain';
  return null; // parks/malls/cinemas without names are excluded
}

const OVERPASS_URL = 'https://overpass-api.de/api/interpreter';

export function useNearbyCoolSpots(
  lat: number | null,
  lon: number | null,
  radiusM = 1500,
): State {
  const [state, setState] = useState<State>({ spots: [], loading: false, error: null });

  useEffect(() => {
    if (lat == null || lon == null) return;
    let cancelled = false;
    setState({ spots: [], loading: true, error: null });

    // One compound Overpass query — parks, malls/dept-stores, cinemas/libraries, water
    const q = [
      `[out:json][timeout:10];`,
      `(`,
      `node["leisure"="park"](around:${radiusM},${lat},${lon});`,
      `way["leisure"="park"](around:${radiusM},${lat},${lon});`,
      `node["shop"~"mall|department_store"](around:${radiusM},${lat},${lon});`,
      `way["shop"~"mall|department_store"](around:${radiusM},${lat},${lon});`,
      `node["amenity"~"cinema|library"](around:${radiusM},${lat},${lon});`,
      `way["amenity"~"cinema|library"](around:${radiusM},${lat},${lon});`,
      `node["amenity"~"drinking_water|water_point|fountain"](around:${radiusM},${lat},${lon});`,
      `);`,
      `out center;`,
    ].join('');

    fetch(OVERPASS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `data=${encodeURIComponent(q)}`,
    })
      .then(r => {
        if (!r.ok) throw new Error(`Overpass ${r.status}`);
        return r.json() as Promise<{ elements: OverpassEl[] }>;
      })
      .then(({ elements }) => {
        if (cancelled) return;
        const seen = new Set<string>();
        const spots: CoolSpot[] = [];

        for (const el of elements) {
          const cls = classify(el.tags);
          if (!cls) continue;

          const name = resolveName(el.tags);
          if (!name) continue;

          // Deduplicate: same name often appears as both a node and a way
          const key = name.toLowerCase().trim();
          if (seen.has(key)) continue;
          seen.add(key);

          // ways return center coords; nodes have lat/lon directly
          const elLat = el.lat ?? el.center?.lat;
          const elLon = el.lon ?? el.center?.lon;
          if (elLat == null || elLon == null) continue;

          const dist = haversineM(lat, lon, elLat, elLon);
          spots.push({
            id: `${el.type}/${el.id}`,
            name,
            lat: elLat,
            lon: elLon,
            distanceM: dist,
            walkMin: Math.max(1, Math.round(dist / 83.3)),
            ...cls,
          });
        }

        spots.sort((a, b) => a.distanceM - b.distanceM);
        if (!cancelled) setState({ spots: spots.slice(0, 3), loading: false, error: null });
      })
      .catch((e: Error) => {
        if (!cancelled) setState({ spots: [], loading: false, error: e.message });
      });

    return () => { cancelled = true; };
  }, [lat, lon, radiusM]);

  return state;
}
