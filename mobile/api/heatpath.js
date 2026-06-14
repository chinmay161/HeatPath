/**
 * Base URL for the HeatPath FastAPI backend.
 * Reads from process.env.EXPO_PUBLIC_API_URL, defaulting to http://localhost:8000.
 */
const BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:8000';

/**
 * Health check endpoint for verifying backend status.
 * @returns {Promise<{status: string, env: string}>} The health status of the API.
 * @throws {Error} If the network request fails or returns a non-OK status.
 */
export async function checkHealth() {
  const response = await fetch(`${BASE_URL}/health`, {
    method: 'GET',
    headers: {
      'Accept': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Health check failed with status: ${response.status}`);
  }

  return await response.json();
}

/**
 * Fetches optimal routes between start and end coordinates based on environmental indices.
 * @param {number|string} startLat - Latitude of start position.
 * @param {number|string} startLon - Longitude of start position.
 * @param {number|string} endLat - Latitude of end position.
 * @param {number|string} endLon - Longitude of end position.
 * @param {number} [n=3] - Number of candidate routes requested.
 * @returns {Promise<{
 *   routes: Array<{
 *     rank: number,
 *     overall_score: number,
 *     shade_safety_score: number,
 *     heat_safety_score: number,
 *     path: Array<{lat: number, lon: number}>,
 *     segment_count: number
 *   }>,
 *   conditions: {
 *     heat_index: number,
 *     aqi_normalised: number,
 *     fetched_at_lat: number,
 *     fetched_at_lon: number
 *   }
 * }>} The routes and general conditions payload.
 * @throws {Error} If the network request fails or returns a non-OK status.
 */
export async function findRoutes(startLat, startLon, endLat, endLon, n = 3) {
  const latStart = typeof startLat === 'number' ? startLat : parseFloat(startLat);
  const lonStart = typeof startLon === 'number' ? startLon : parseFloat(startLon);
  const latEnd = typeof endLat === 'number' ? endLat : parseFloat(endLat);
  const lonEnd = typeof endLon === 'number' ? endLon : parseFloat(endLon);

  const response = await fetch(`${BASE_URL}/find-routes`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    body: JSON.stringify({
      start: { lat: latStart, lon: lonStart },
      end: { lat: latEnd, lon: lonEnd },
      n_routes: n,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => '');
    throw new Error(`Failed to find routes: ${response.status} ${errorText}`);
  }

  return await response.json();
}

/**
 * Fetches real-time environmental conditions for a specific coordinate.
 * @param {number|string} lat - Latitude.
 * @param {number|string} lon - Longitude.
 * @returns {Promise<{heat_index: number, shade_index: number, aqi_index: number}>} Environmental conditions.
 * @throws {Error} If the network request fails or returns a non-OK status.
 */
export async function getConditions(lat, lon) {
  const latitude = typeof lat === 'number' ? lat : parseFloat(lat);
  const longitude = typeof lon === 'number' ? lon : parseFloat(lon);

  const response = await fetch(`${BASE_URL}/conditions?lat=${latitude}&lon=${longitude}`, {
    method: 'GET',
    headers: {
      'Accept': 'application/json',
    },
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => '');
    throw new Error(`Failed to fetch conditions: ${response.status} ${errorText}`);
  }

  return await response.json();
}

/**
 * Updates user routing preferences (heat and AQI sensitivity).
 * @param {number} heatSensitivity - Heat sensitivity 1–10.
 * @param {number} aqiSensitivity - AQI sensitivity 1–10.
 * @returns {Promise<{status: string}>}
 */
export async function updatePreferences(heatSensitivity, aqiSensitivity, avoidCrowds = false) {
  const response = await fetch(`${BASE_URL}/preferences/`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    body: JSON.stringify({
      heat_sensitivity: heatSensitivity,
      aqi_sensitivity:  aqiSensitivity,
      avoid_crowds:     avoidCrowds,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => '');
    throw new Error(`Failed to update preferences: ${response.status} ${errorText}`);
  }

  return await response.json();
}

/**
 * Fetches current user routing preferences.
 * @returns {Promise<{heat_sensitivity: number, aqi_sensitivity: number}>}
 */
export async function getPreferences() {
  const response = await fetch(`${BASE_URL}/preferences/`, {
    method: 'GET',
    headers: {
      'Accept': 'application/json',
    },
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => '');
    throw new Error(`Failed to fetch preferences: ${response.status} ${errorText}`);
  }

  return await response.json();
}