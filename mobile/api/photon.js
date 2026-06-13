/**
 * Geocoding client using the Komoot Photon API (OSM-based, keyless).
 */

/**
 * Searches for places matching the query, using an optional location bias.
 *
 * @param {string} query - The search query string.
 * @param {number} [biasLat=18.9220] - Latitude for location bias (defaults to Mumbai).
 * @param {number} [biasLon=72.8347] - Longitude for location bias (defaults to Mumbai).
 * @returns {Promise<Array<{
 *   label: string,
 *   lat: number,
 *   lon: number,
 *   osm_value: string
 * }>>} An array of matched place objects. Returns an empty array on error or empty query.
 */
export async function searchPlaces(query, biasLat = 18.9220, biasLon = 72.8347) {
  if (!query || !query.trim()) {
    return [];
  }

  try {
    const url = `https://photon.komoot.io/api/?q=${encodeURIComponent(
      query.trim()
    )}&limit=5&lang=en&lat=${biasLat}&lon=${biasLon}`;

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
      },
    });

    if (!response.ok) {
      console.warn(`Photon API geocoding failed with status: ${response.status}`);
      return [];
    }

    const data = await response.json();
    const features = data.features || [];

    return features.map((feature) => {
      const { geometry, properties } = feature;
      const coordinates = geometry?.coordinates || [0, 0];

      // GeoJSON has [longitude, latitude], so we flip them on parse.
      const lon = coordinates[0];
      const lat = coordinates[1];

      const { name, city, state } = properties || {};
      const labelParts = [];
      if (name) labelParts.push(name);
      if (city) labelParts.push(city);
      if (state) labelParts.push(state);

      const label = labelParts.join(', ') || 'Unknown Location';
      const osm_value = properties?.osm_value || 'default';

      return {
        label,
        lat,
        lon,
        osm_value,
      };
    });
  } catch (error) {
    console.error('Error fetching places from Photon:', error);
    return [];
  }
}
