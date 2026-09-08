import { Platform } from 'react-native';

// Android emulator routes localhost through 10.0.2.2.
const apiBaseFromEnv = process.env.EXPO_PUBLIC_API_URL?.trim();

export const API_BASE =
  apiBaseFromEnv ||
  (() => {
    console.warn('[api] EXPO_PUBLIC_API_URL not set, using emulator default');
    return Platform.OS === 'android'
      ? 'http://10.0.2.2:8000'
      : 'http://localhost:8000';
  })();

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

export type UserProfile = {
  name: string;
  email?: string | null;
  bio?: string | null;
  avatar_id: string;
  created_at?: string;
  updated_at?: string;
};

export async function getProfile(): Promise<UserProfile> {
  const res = await fetch(`${API_BASE}/profile/`);
  if (!res.ok) {
    throw new Error(`Profile fetch failed: ${res.status}`);
  }
  return res.json() as Promise<UserProfile>;
}

export async function updateProfile(data: Partial<UserProfile> & { name: string }): Promise<UserProfile> {
  const res = await fetch(`${API_BASE}/profile/`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: `Error ${res.status}` }));
    throw new Error(err.detail || 'Failed to update profile');
  }
  return res.json() as Promise<UserProfile>;
}

