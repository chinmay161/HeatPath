// Photon (komoot) geocoding - free, no API key required
const PHOTON_URL = 'https://photon.komoot.io/api/';

export async function searchPlaces(query, biasLat = 18.9220, biasLon = 72.8347) {
  const params = new URLSearchParams({
    q: query,
    limit: '6',
    lat: String(biasLat),
    lon: String(biasLon),
  });

  try {
    const response = await fetch(PHOTON_URL + '?' + params.toString());
    if (!response.ok) return [];
    const data = await response.json();

    return (data.features || []).map((f) => {
      const props = f.properties || {};
      const coords = f.geometry?.coordinates || [];
      const parts = [props.name, props.street, props.city, props.state]
        .filter(Boolean);
      return {
        label: parts.join(', '),
        lat: coords[1],
        lon: coords[0],
        osm_value: props.osm_value,
      };
    }).filter((p) => p.lat && p.lon);
  } catch {
    return [];
  }
}
