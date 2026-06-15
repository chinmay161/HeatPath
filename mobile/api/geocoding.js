// Nominatim (OpenStreetMap) reverse geocoding - free, no API key required
const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/reverse';

export async function reverseGeocode(lat, lon) {
  const params = new URLSearchParams({
    lat: String(lat),
    lon: String(lon),
    format: 'json',
  });

  try {
    const response = await fetch(NOMINATIM_URL + '?' + params.toString());
    if (!response.ok) return null;
    const data = await response.json();

    const addr = data.address || {};
    const locality = addr.city || addr.town || addr.suburb || addr.county || '';
    const region = addr.state && addr.state !== locality ? addr.state : '';
    const label = [locality, region].filter(Boolean).join(', ');

    return label || null;
  } catch {
    return null;
  }
}
