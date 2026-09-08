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

export type FavoriteRoute = {
  id: string;
  name: string;
  start_lat: number;
  start_lon: number;
  end_lat: number;
  end_lon: number;
  created_at?: string;
};

export type UserPreferences = {
  heat_sensitivity: number;
  aqi_sensitivity: number;
  avoid_crowds: boolean;
  walking_speed: 'slow' | 'normal' | 'brisk';
  accessibility: 'none' | 'wheelchair' | 'flat_ground';
  units: 'celsius' | 'fahrenheit';
  theme: 'system' | 'light' | 'dark';
  favorite_routes: FavoriteRoute[];
};

export async function getPreferences(): Promise<UserPreferences> {
  const res = await fetch(`${API_BASE}/preferences/`);
  if (!res.ok) {
    throw new Error(`Preferences fetch failed: ${res.status}`);
  }
  return res.json() as Promise<UserPreferences>;
}

export async function updatePreferences(data: Partial<UserPreferences>): Promise<UserPreferences> {
  const res = await fetch(`${API_BASE}/preferences/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: `Error ${res.status}` }));
    throw new Error(err.detail || 'Failed to update preferences');
  }
  const body = await res.json();
  return (body.preferences || data) as UserPreferences;
}

export type HourlyForecastItem = {
  time: string;
  temperature_c: number;
  humidity_pct: number;
  feels_like_c: number;
  uv_index: number;
  precipitation_probability: number;
  wind_speed_kmh: number;
  comfort_score: number;
  severity: 'SAFE' | 'CAUTION' | 'HIGH' | 'EXTREME';
  is_best_time: boolean;
};

export type HourlyForecastResponse = {
  status: 'available' | 'unavailable';
  provider: string;
  provider_status: string;
  observed_at: string | null;
  retry_after?: number | null;
  hours: HourlyForecastItem[];
};

export async function getHourlyForecast(lat: number, lon: number): Promise<HourlyForecastResponse> {
  const res = await fetch(`${API_BASE}/forecast/hourly?lat=${lat}&lon=${lon}`);
  if (!res.ok) {
    throw new Error(`Forecast fetch failed: ${res.status}`);
  }
  return res.json() as Promise<HourlyForecastResponse>;
}

export type CoolSpotItem = {
  id: string;
  name: string;
  lat: number;
  lon: number;
  distance_m: number;
  walk_min: number;
  icon: 'shade' | 'ac' | 'water';
  tone: 'green' | 'blue';
  badge: 'DEEP SHADE' | 'A/C REFUGE' | 'WATER';
  category: 'shade' | 'ac' | 'water';
};

export type CoolSpotsResponse = {
  status: 'available' | 'unavailable';
  provider: string;
  spots: CoolSpotItem[];
  total: number;
  center_lat: number;
  center_lon: number;
};

export async function getCoolSpots(
  lat: number,
  lon: number,
  radiusM: number = 1500,
  category: string = 'all',
): Promise<CoolSpotsResponse> {
  const url = `${API_BASE}/cool-spots?lat=${lat}&lon=${lon}&radius_m=${radiusM}&category=${encodeURIComponent(category)}`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Cool spots fetch failed: ${res.status}`);
  }
  return res.json() as Promise<CoolSpotsResponse>;
}
