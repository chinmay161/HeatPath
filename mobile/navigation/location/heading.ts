import { haversineDistanceMeters } from './filters';
import type { Heading, LocationSample } from './types';

export function calculateForwardBearing(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180.0;
  const toDeg = (rad: number) => (rad * 180.0) / Math.PI;

  const rLat1 = toRad(lat1);
  const rLat2 = toRad(lat2);
  const dLon = toRad(lon2 - lon1);

  const y = Math.sin(dLon) * Math.cos(rLat2);
  const x =
    Math.cos(rLat1) * Math.sin(rLat2) -
    Math.sin(rLat1) * Math.cos(rLat2) * Math.cos(dLon);

  const brng = (toDeg(Math.atan2(y, x)) + 360.0) % 360.0;
  return parseFloat(brng.toFixed(1));
}

export function degreesToCardinal(degrees: number | null): string {
  if (degrees === null || !Number.isFinite(degrees)) {
    return '—';
  }
  const directions = [
    'N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE',
    'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW',
  ];
  const idx = Math.round(((degrees % 360) / 22.5)) % 16;
  return directions[idx];
}

export class HeadingEstimator {
  private lastCompassHeading: Heading | null = null;
  private lastCompassTimestamp = 0;
  private previousFix: LocationSample | null = null;
  private lastResolvedHeading: Heading = {
    degrees: null,
    source: 'unknown',
  };

  public updateCompassHeading(heading: Heading, timestamp: number = Date.now()): void {
    if (heading.degrees !== null && Number.isFinite(heading.degrees)) {
      this.lastCompassHeading = heading;
      this.lastCompassTimestamp = timestamp;
    }
  }

  public resolveHeading(
    currentSample: LocationSample,
    currentTimestamp: number = Date.now()
  ): Heading {
    // 1. Priority 1: Device compass if fresh (< 3.5s old)
    if (
      this.lastCompassHeading &&
      this.lastCompassHeading.degrees !== null &&
      currentTimestamp - this.lastCompassTimestamp < 3500
    ) {
      this.lastResolvedHeading = this.lastCompassHeading;
      this.previousFix = currentSample;
      return this.lastResolvedHeading;
    }

    // 2. Priority 2: GPS heading from satellite fix when moving (> 0.5 m/s)
    if (
      currentSample.heading !== null &&
      Number.isFinite(currentSample.heading) &&
      currentSample.heading >= 0 &&
      currentSample.speed !== null &&
      currentSample.speed > 0.5
    ) {
      this.lastResolvedHeading = {
        degrees: parseFloat(currentSample.heading.toFixed(1)),
        source: 'gps',
      };
      this.previousFix = currentSample;
      return this.lastResolvedHeading;
    }

    // 3. Priority 3: Previous movement vector if moved >= 2.0 meters
    if (this.previousFix) {
      const distanceMoved = haversineDistanceMeters(
        this.previousFix.latitude,
        this.previousFix.longitude,
        currentSample.latitude,
        currentSample.longitude
      );

      if (distanceMoved >= 2.0) {
        const bearing = calculateForwardBearing(
          this.previousFix.latitude,
          this.previousFix.longitude,
          currentSample.latitude,
          currentSample.longitude
        );

        this.lastResolvedHeading = {
          degrees: bearing,
          source: 'movement_vector',
        };
        this.previousFix = currentSample;
        return this.lastResolvedHeading;
      }
    } else {
      this.previousFix = currentSample;
    }

    // 4. Fallback: Keep last known resolved heading if recent, else unknown
    return this.lastResolvedHeading;
  }

  public reset(): void {
    this.lastCompassHeading = null;
    this.lastCompassTimestamp = 0;
    this.previousFix = null;
    this.lastResolvedHeading = {
      degrees: null,
      source: 'unknown',
    };
  }
}
