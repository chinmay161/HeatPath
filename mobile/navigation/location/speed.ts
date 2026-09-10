import { haversineDistanceMeters } from './filters';
import type { LocationSample, SpeedEstimate } from './types';

const MAX_WALKING_SPEED_MPS = 8.0; // ~28.8 km/h max realistic running/pedestrian speed
const ROLLING_WINDOW_SIZE = 6;

export class SpeedEstimator {
  private previousSample: LocationSample | null = null;
  private readonly recentSpeeds: number[] = [];
  private totalDistanceMeters = 0;
  private totalElapsedSeconds = 0;

  public estimateSpeed(currentSample: LocationSample): SpeedEstimate {
    let currentSpeedMps: number | null = null;
    let isEstimated = false;

    // 1. Use device hardware speed if available and valid
    if (
      currentSample.speed !== null &&
      Number.isFinite(currentSample.speed) &&
      currentSample.speed >= 0
    ) {
      currentSpeedMps = Math.min(currentSample.speed, MAX_WALKING_SPEED_MPS);
      isEstimated = false;
    } else if (this.previousSample) {
      // 2. Derive speed from distance / elapsed time
      const timeDiffSeconds =
        (currentSample.timestamp - this.previousSample.timestamp) / 1000.0;

      if (timeDiffSeconds >= 0.5) {
        const distanceMeters = haversineDistanceMeters(
          this.previousSample.latitude,
          this.previousSample.longitude,
          currentSample.latitude,
          currentSample.longitude
        );

        if (distanceMeters >= 0.5) {
          const derivedSpeed = distanceMeters / timeDiffSeconds;
          currentSpeedMps = Math.min(
            Math.max(0, derivedSpeed),
            MAX_WALKING_SPEED_MPS
          );
          isEstimated = true;

          this.totalDistanceMeters += distanceMeters;
          this.totalElapsedSeconds += timeDiffSeconds;
        } else {
          // Stationary
          currentSpeedMps = 0;
          isEstimated = true;
        }
      }
    }

    if (currentSpeedMps !== null) {
      this.recentSpeeds.push(currentSpeedMps);
      if (this.recentSpeeds.length > ROLLING_WINDOW_SIZE) {
        this.recentSpeeds.shift();
      }
    }

    this.previousSample = currentSample;

    const averageSpeedMps =
      this.recentSpeeds.length > 0
        ? this.recentSpeeds.reduce((a, b) => a + b, 0) / this.recentSpeeds.length
        : currentSpeedMps;

    const walkingSpeedKmph =
      averageSpeedMps !== null ? averageSpeedMps * 3.6 : null;

    return {
      currentSpeedMps: currentSpeedMps !== null ? parseFloat(currentSpeedMps.toFixed(2)) : null,
      averageSpeedMps: averageSpeedMps !== null ? parseFloat(averageSpeedMps.toFixed(2)) : null,
      walkingSpeedKmph: walkingSpeedKmph !== null ? parseFloat(walkingSpeedKmph.toFixed(1)) : null,
      isEstimated,
    };
  }

  public reset(): void {
    this.previousSample = null;
    this.recentSpeeds.length = 0;
    this.totalDistanceMeters = 0;
    this.totalElapsedSeconds = 0;
  }
}
