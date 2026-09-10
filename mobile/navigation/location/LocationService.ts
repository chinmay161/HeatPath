import { DEFAULT_LOCATION_CONFIG, type LocationConfig } from './config';
import { filterLocationSample } from './filters';
import { evaluateGpsHealth, getAccuracyCategory } from './health';
import { HeadingEstimator } from './heading';
import { ForegroundLocationProvider, type ILocationProvider } from './LocationProvider';
import { gpsLogger } from './logger';
import {
  checkLocationPermissions,
  requestLocationPermissions,
  isLocationServicesEnabled,
  getPermissionErrorMessage,
} from './permissions';
import { SpeedEstimator } from './speed';
import type {
  ErrorListener,
  GPSHealth,
  Heading,
  HeadingListener,
  HealthListener,
  LocationListener,
  LocationPermission,
  LocationSample,
  SpeedEstimate,
  TrackingStatus,
} from './types';

export class LocationService {
  private readonly provider: ILocationProvider;
  private readonly config: LocationConfig;
  private readonly speedEstimator: SpeedEstimator;
  private readonly headingEstimator: HeadingEstimator;

  private permission: LocationPermission = 'unknown';
  private status: TrackingStatus = 'idle';
  private latestLocation: LocationSample | null = null;
  private latestHeading: Heading = { degrees: null, source: 'unknown' };
  private latestSpeed: SpeedEstimate = {
    currentSpeedMps: null,
    averageSpeedMps: null,
    walkingSpeedKmph: null,
    isEstimated: false,
  };
  private gpsHealth: GPSHealth = 'searching';

  private readonly locationListeners = new Set<LocationListener>();
  private readonly headingListeners = new Set<HeadingListener>();
  private readonly healthListeners = new Set<HealthListener>();
  private readonly errorListeners = new Set<ErrorListener>();

  private healthCheckInterval: ReturnType<typeof setInterval> | null = null;

  constructor(
    provider: ILocationProvider = new ForegroundLocationProvider(),
    config: LocationConfig = DEFAULT_LOCATION_CONFIG
  ) {
    this.provider = provider;
    this.config = config;
    this.speedEstimator = new SpeedEstimator();
    this.headingEstimator = new HeadingEstimator();
  }

  public async getPermissionStatus(): Promise<LocationPermission> {
    this.permission = await checkLocationPermissions();
    return this.permission;
  }

  public async requestPermissions(): Promise<LocationPermission> {
    this.permission = await requestLocationPermissions();
    return this.permission;
  }

  public async startTracking(): Promise<void> {
    if (this.status === 'tracking' || this.status === 'starting') {
      return;
    }

    this.status = 'starting';

    // 1. Check services and permissions
    const servicesEnabled = await isLocationServicesEnabled();
    if (!servicesEnabled) {
      this.status = 'error';
      const msg = getPermissionErrorMessage('denied', false) ?? 'Location services disabled';
      const err = new Error(msg);
      this.notifyError(err);
      throw err;
    }

    if (this.permission !== 'granted') {
      this.permission = await this.requestPermissions();
    }

    if (this.permission !== 'granted') {
      this.status = 'error';
      gpsLogger.log('gps_permission_denied', { permission: this.permission }, 'warn');
      const msg = getPermissionErrorMessage(this.permission, true) ?? 'Location permission denied';
      const err = new Error(msg);
      this.notifyError(err);
      throw err;
    }

    // 2. Start provider tracking
    try {
      await this.provider.startTracking(
        this.config,
        (sample) => this.onRawLocation(sample),
        (heading) => this.onRawHeading(heading),
        (error) => this.onError(error)
      );

      this.status = 'tracking';
      gpsLogger.log('gps_started', {
        accuracy: this.config.accuracy,
        intervalMs: this.config.timeIntervalMs,
      });

      // 3. Start health periodic check
      this.startHealthCheck();
    } catch (error) {
      this.status = 'error';
      const err = error instanceof Error ? error : new Error(String(error));
      this.notifyError(err);
      throw err;
    }
  }

  public async stopTracking(): Promise<void> {
    this.stopHealthCheck();

    try {
      await this.provider.stopTracking();
    } catch {
      // Safe disposal
    }

    this.speedEstimator.reset();
    this.headingEstimator.reset();

    this.status = 'stopped';
    this.gpsHealth = 'searching';
    gpsLogger.log('gps_stopped');
  }

  public subscribeLocation(listener: LocationListener): () => void {
    this.locationListeners.add(listener);
    if (this.latestLocation) {
      listener(this.latestLocation);
    }
    return () => {
      this.locationListeners.delete(listener);
    };
  }

  public subscribeHeading(listener: HeadingListener): () => void {
    this.headingListeners.add(listener);
    listener(this.latestHeading);
    return () => {
      this.headingListeners.delete(listener);
    };
  }

  public subscribeHealth(listener: HealthListener): () => void {
    this.healthListeners.add(listener);
    listener(this.gpsHealth);
    return () => {
      this.healthListeners.delete(listener);
    };
  }

  public subscribeError(listener: ErrorListener): () => void {
    this.errorListeners.add(listener);
    return () => {
      this.errorListeners.delete(listener);
    };
  }

  public getLatestLocation(): LocationSample | null {
    return this.latestLocation;
  }

  public getLatestHeading(): Heading {
    return this.latestHeading;
  }

  public getLatestSpeed(): SpeedEstimate {
    return this.latestSpeed;
  }

  public getGPSHealth(): GPSHealth {
    return this.gpsHealth;
  }

  public getTrackingStatus(): TrackingStatus {
    return this.status;
  }

  public getPermission(): LocationPermission {
    return this.permission;
  }

  private onRawLocation(sample: LocationSample): void {
    const filter = filterLocationSample(this.latestLocation, sample, this.config);
    if (!filter.accepted) {
      return;
    }

    // Process valid sample
    this.latestLocation = sample;
    this.latestSpeed = this.speedEstimator.estimateSpeed(sample);
    this.latestHeading = this.headingEstimator.resolveHeading(sample);

    // Evaluate health
    this.updateHealth();

    // Log accuracy category transitions
    const cat = getAccuracyCategory(sample.accuracy);
    gpsLogger.onAccuracyChange(cat, sample.accuracy);

    // Fan-out to subscribers
    for (const listener of this.locationListeners) {
      try {
        listener(sample);
      } catch (err) {
        if (__DEV__) console.warn('[LocationService] Listener error:', err);
      }
    }
  }

  private onRawHeading(heading: Heading): void {
    this.headingEstimator.updateCompassHeading(heading);
    this.latestHeading = heading;

    for (const listener of this.headingListeners) {
      try {
        listener(heading);
      } catch (err) {
        if (__DEV__) console.warn('[LocationService] Heading listener error:', err);
      }
    }
  }

  private onError(error: Error): void {
    this.notifyError(error);
  }

  private notifyError(error: Error): void {
    for (const listener of this.errorListeners) {
      try {
        listener(error);
      } catch {
        // Safe dispatch
      }
    }
  }

  private updateHealth(): void {
    const nextHealth = evaluateGpsHealth({
      permission: this.permission,
      lastSample: this.latestLocation,
      now: Date.now(),
    });

    if (this.gpsHealth !== nextHealth) {
      this.gpsHealth = nextHealth;
      gpsLogger.onHealthChange(nextHealth);

      for (const listener of this.healthListeners) {
        try {
          listener(nextHealth);
        } catch {
          // Safe dispatch
        }
      }
    }
  }

  private startHealthCheck(): void {
    this.stopHealthCheck();
    this.healthCheckInterval = setInterval(() => {
      this.updateHealth();
    }, this.config.healthUpdateIntervalMs);
  }

  private stopHealthCheck(): void {
    if (this.healthCheckInterval !== null) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }
  }
}

export const locationService = new LocationService();
