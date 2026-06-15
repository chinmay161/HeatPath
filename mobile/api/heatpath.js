const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:8000';

export async function findRoutes(startLat, startLon, endLat, endLon) {
  const response = await fetch(${API_URL}/find-routes/, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      start: { lat: parseFloat(startLat), lon: parseFloat(startLon) },
      end: { lat: parseFloat(endLat), lon: parseFloat(endLon) },
      n_routes: 2,
    }),
  });
  if (!response.ok) throw new Error('Failed to find routes');
  return response.json();
}

export async function getConditions(lat, lon) {
  const response = await fetch(${API_URL}/conditions/?lat=&lon=);
  if (!response.ok) throw new Error('Failed to get conditions');
  return response.json();
}

export async function getPreferences() {
  const response = await fetch(${API_URL}/preferences/);
  if (!response.ok) throw new Error('Failed to get preferences');
  return response.json();
}

export async function updatePreferences(heatSensitivity, aqiSensitivity, avoidCrowds) {
  const response = await fetch(${API_URL}/preferences/, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      heat_sensitivity: heatSensitivity,
      aqi_sensitivity: aqiSensitivity,
      avoid_crowds: avoidCrowds,
    }),
  });
  if (!response.ok) throw new Error('Failed to update preferences');
  return response.json();
}
