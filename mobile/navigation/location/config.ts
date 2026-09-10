import * as Location from 'expo-location';

export interface LocationConfig {
  readonly accuracy: Location.Accuracy;
  readonly timeIntervalMs: number;
  readonly distanceIntervalM: number;
  readonly maxAccuracyThresholdM: number;
  readonly staleSampleMaxAgeMs: number;
  readonly maxHumanSpeedMps: number;
  readonly healthUpdateIntervalMs: number;
}

export const DEFAULT_LOCATION_CONFIG: LocationConfig = {
  // Best for navigation gives highest accuracy GPS on device
  accuracy: Location.Accuracy.BestForNavigation,
  // 1-second interval for responsive navigation
  timeIntervalMs: 1000,
  // 1-meter movement threshold
  distanceIntervalM: 1,
  // Discard fixes worse than 65 meters horizontal accuracy
  maxAccuracyThresholdM: 65,
  // Discard samples older than 12 seconds
  staleSampleMaxAgeMs: 12_000,
  // Pedestrian filter: reject jumps exceeding ~43 km/h
  maxHumanSpeedMps: 12.0,
  // Check GPS signal health every 2 seconds
  healthUpdateIntervalMs: 2000,
};
