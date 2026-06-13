const API_BASE = 'http://127.0.0.1:8000';

export async function findRoutes(startLat, startLon, endLat, endLon) {
  const response = await fetch(`${API_BASE}/find-routes/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      start: { lat: startLat, lon: startLon },
      end:   { lat: endLat,   lon: endLon   },
      n_routes: 2,
    }),
  });
  if (!response.ok) throw new Error(`API error: ${response.status}`);
  return response.json();
}

export async function getConditions(lat, lon) {
  const response = await fetch(`${API_BASE}/conditions/?lat=${lat}&lon=${lon}`);
  if (!response.ok) throw new Error(`API error: ${response.status}`);
  return response.json();
}