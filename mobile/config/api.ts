import { Platform } from 'react-native';

// Android emulator routes localhost through 10.0.2.2.
// For a physical device, replace with your machine's LAN IP.
export const API_BASE =
  Platform.OS === 'android' ? 'http://10.0.2.2:8000' : 'http://localhost:8000';

export type HeatZonesBounds = {
  north: number;
  south: number;
  east: number;
  west: number;
};

export type HeatZonePoint = {
  lat: number;
  lon: number;
  comfort_score: number;
  shade_pct: number;
  source: string;
};

export type HeatZonesResponse = {
  grid: HeatZonePoint[];
  resolution: number;
  bounds: HeatZonesBounds;
  conditions: {
    heat_index: number;
    aqi: number;
    solar_phase: string;
  };
  generated_at: string;
};

/**
 * Fetch dense heat-zone grid points for a visible map viewport.
 *
 * @param bounds Visible map bounds as north/south/east/west lat/lon values.
 * @param resolution Number of grid cells per side; backend clamps to 8-25.
 * @returns Heat-zone grid response for gradient overlay rendering.
 */
export async function getHeatZones(
  bounds: HeatZonesBounds,
  resolution = 15,
): Promise<HeatZonesResponse> {
  const { north, south, east, west } = bounds;
  const url =
    `${API_BASE}/heat-zones?north=${north}&south=${south}` +
    `&east=${east}&west=${west}&resolution=${resolution}`;
  const res = await fetch(url);
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Heat zones fetch failed: ${err}`);
  }
  return res.json() as Promise<HeatZonesResponse>;
}
