import type { LocationConfig } from './config';
import type {
  LocationSample,
  Heading,
  LocationListener,
  HeadingListener,
  ErrorListener,
} from './types';

function getPlatformOS(): string {
  try {
    return require('react-native').Platform?.OS ?? 'web';
  } catch {
    return typeof navigator !== 'undefined' ? 'web' : 'node';
  }
}

function getExpoLocation() {
  try {
    return require('expo-location');
  } catch {
    return null;
  }
}

/**
 * Common interface for location providers, preparing infrastructure for
 * future background location provider support.
 */
export interface ILocationProvider {
  startTracking(
    config: LocationConfig,
    onLocation: LocationListener,
    onHeading: HeadingListener,
    onError: ErrorListener
  ): Promise<void>;
  stopTracking(): Promise<void>;
  isTracking(): boolean;
}

/**
 * Foreground location provider utilizing Expo Location and device sensors.
 */
export class ForegroundLocationProvider implements ILocationProvider {
  private positionSubscription: { remove: () => void } | null = null;
  private headingSubscription: { remove: () => void } | null = null;
  private webWatchId: number | null = null;
  private tracking = false;

  public isTracking(): boolean {
    return this.tracking;
  }

  public async startTracking(
    config: LocationConfig,
    onLocation: LocationListener,
    onHeading: HeadingListener,
    onError: ErrorListener
  ): Promise<void> {
    if (this.tracking) {
      return;
    }

    try {
      this.tracking = true;

      // Platform specific subscription: Web vs Native
      if (getPlatformOS() === 'web') {
        this.startWebTracking(config, onLocation, onError);
      } else {
        await this.startNativeTracking(config, onLocation, onHeading, onError);
      }
    } catch (error) {
      this.tracking = false;
      onError(error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  public async stopTracking(): Promise<void> {
    this.tracking = false;

    if (this.positionSubscription) {
      try {
        this.positionSubscription.remove();
      } catch {
        // Safe disposal
      }
      this.positionSubscription = null;
    }

    if (this.headingSubscription) {
      try {
        this.headingSubscription.remove();
      } catch {
        // Safe disposal
      }
      this.headingSubscription = null;
    }

    if (this.webWatchId !== null && typeof navigator !== 'undefined' && navigator.geolocation) {
      try {
        navigator.geolocation.clearWatch(this.webWatchId);
      } catch {
        // Safe disposal
      }
      this.webWatchId = null;
    }
  }

  private async startNativeTracking(
    config: LocationConfig,
    onLocation: LocationListener,
    onHeading: HeadingListener,
    onError: ErrorListener
  ): Promise<void> {
    const Location = getExpoLocation();
    if (!Location) {
      onError(new Error('Location module is not available on this platform.'));
      return;
    }

    // 1. Watch position
    this.positionSubscription = await Location.watchPositionAsync(
      {
        accuracy: config.accuracy,
        timeInterval: config.timeIntervalMs,
        distanceInterval: config.distanceIntervalM,
      },
      (loc: { coords: { latitude: number; longitude: number; accuracy: number | null; altitude: number | null; heading: number | null; speed: number | null }; timestamp: number }) => {
        const sample: LocationSample = {
          latitude: loc.coords.latitude,
          longitude: loc.coords.longitude,
          timestamp: loc.timestamp,
          accuracy: loc.coords.accuracy ?? 999,
          altitude: loc.coords.altitude ?? null,
          heading: loc.coords.heading != null && loc.coords.heading >= 0 ? loc.coords.heading : null,
          speed: loc.coords.speed != null && loc.coords.speed >= 0 ? loc.coords.speed : null,
          source: 'gps',
        };
        onLocation(sample);
      }
    );

    // 2. Watch compass heading (if device sensor is available)
    try {
      this.headingSubscription = await Location.watchHeadingAsync((h: { trueHeading: number; magHeading: number; accuracy: number | null }) => {
        const degrees = h.trueHeading >= 0 ? h.trueHeading : (h.magHeading >= 0 ? h.magHeading : null);
        if (degrees !== null) {
          const heading: Heading = {
            degrees,
            source: 'compass',
            accuracy: h.accuracy,
          };
          onHeading(heading);
        }
      });
    } catch {
      // Compass not available on device/simulator; heading will fallback to GPS / movement vector
    }
  }

  private startWebTracking(
    config: LocationConfig,
    onLocation: LocationListener,
    onError: ErrorListener
  ): void {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      onError(new Error('Geolocation is not supported in this browser environment.'));
      return;
    }

    this.webWatchId = navigator.geolocation.watchPosition(
      (pos: GeolocationPosition) => {
        const sample: LocationSample = {
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          timestamp: pos.timestamp,
          accuracy: pos.coords.accuracy ?? 999,
          altitude: pos.coords.altitude ?? null,
          heading: pos.coords.heading != null && !Number.isNaN(pos.coords.heading) ? pos.coords.heading : null,
          speed: pos.coords.speed != null && !Number.isNaN(pos.coords.speed) ? pos.coords.speed : null,
          source: 'gps',
        };
        onLocation(sample);
      },
      (err: GeolocationPositionError) => {
        onError(new Error(`Web geolocation error (${err.code}): ${err.message}`));
      },
      {
        enableHighAccuracy: true,
        maximumAge: config.staleSampleMaxAgeMs,
        timeout: 10_000,
      }
    );
  }
}
