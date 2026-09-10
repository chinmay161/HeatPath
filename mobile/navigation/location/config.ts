export enum LocationAccuracyMode {
  Lowest = 1,
  Low = 2,
  Balanced = 3,
  High = 4,
  Highest = 5,
  BestForNavigation = 6,
}

export interface LocationConfig {
  readonly accuracy: number;
  readonly timeIntervalMs: number;
  readonly distanceIntervalM: number;
  readonly maxAccuracyThresholdM: number;
  readonly staleSampleMaxAgeMs: number;
  readonly maxHumanSpeedMps: number;
  readonly healthUpdateIntervalMs: number;
}

export const DEFAULT_LOCATION_CONFIG: LocationConfig = {
  // Best for navigation gives highest accuracy GPS on device (matches Location.Accuracy.BestForNavigation = 6)
  accuracy: LocationAccuracyMode.BestForNavigation,
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
