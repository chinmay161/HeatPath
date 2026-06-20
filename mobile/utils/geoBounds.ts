/**
 * Compute a bounding box around a given GPS coordinate for a locked radius in kilometers.
 *
 * @param lat Latitude of the center point
 * @param lon Longitude of the center point
 * @param radiusKm Bounding box radius in kilometers (e.g. 2 for a 4km x 4km box)
 * @returns HeatZonesBounds containing north, south, east, and west coordinates
 */
export function boundsAroundPoint(lat: number, lon: number, radiusKm: number) {
  const latDelta = radiusKm / 111;  // ~111km per degree latitude
  const lonDelta = radiusKm / (111 * Math.cos(lat * Math.PI / 180));
  return {
    north: lat + latDelta,
    south: lat - latDelta,
    east: lon + lonDelta,
    west: lon - lonDelta,
  };
}
