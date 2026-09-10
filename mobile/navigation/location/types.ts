/**
 * Strongly typed location data models for the HeatPath navigation engine.
 */

export interface LocationSample {
  readonly latitude: number;
  readonly longitude: number;
  readonly timestamp: number;
  readonly accuracy: number; // Horizontal accuracy in meters
  readonly altitude: number | null;
  readonly heading: number | null; // Degrees 0–359.9
  readonly speed: number | null; // Speed in meters per second
  readonly source: 'gps' | 'estimated' | 'compass';
}

export type LocationAccuracyCategory = 'high' | 'medium' | 'low' | 'unusable';

export type LocationPermission =
  | 'unknown'
  | 'requesting'
  | 'granted'
  | 'denied'
  | 'restricted';

export type TrackingStatus =
  | 'idle'
  | 'starting'
  | 'tracking'
  | 'paused'
  | 'error'
  | 'stopped';

export type GPSHealth = 'healthy' | 'weak' | 'searching' | 'lost';

export interface Heading {
  readonly degrees: number | null;
  readonly source: 'compass' | 'gps' | 'movement_vector' | 'unknown';
  readonly accuracy?: number | null;
}

export interface SpeedEstimate {
  readonly currentSpeedMps: number | null;
  readonly averageSpeedMps: number | null;
  readonly walkingSpeedKmph: number | null;
  readonly isEstimated: boolean;
}

export type LocationListener = (sample: LocationSample) => void;
export type HeadingListener = (heading: Heading) => void;
export type HealthListener = (health: GPSHealth) => void;
export type ErrorListener = (error: Error) => void;
