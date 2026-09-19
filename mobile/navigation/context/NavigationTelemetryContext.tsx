/**
 * NavigationTelemetryContext.tsx
 *
 * High-frequency sensor context (1 Hz GPS updates).
 * Encapsulates live coordinates, heading compass, speed estimate, and satellite fix health.
 * Isolated to prevent re-rendering the entire application UI tree on every GPS fix (HIGH-2).
 */

import { createContext } from 'react';
import type {
  GPSHealth,
  Heading,
  LocationSample,
  SpeedEstimate,
} from '../location/types';

export interface NavigationTelemetryContextValue {
  readonly location: LocationSample | null;
  readonly heading: Heading;
  readonly speed: SpeedEstimate;
  readonly gpsHealth: GPSHealth;
  readonly gpsError: string | null;
  readonly isGpsTracking: boolean;
}

export const NavigationTelemetryContext = createContext<NavigationTelemetryContextValue | null>(null);
