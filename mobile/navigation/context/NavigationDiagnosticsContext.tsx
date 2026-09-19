/**
 * NavigationDiagnosticsContext.tsx
 *
 * Intelligent navigation diagnostics and status context.
 * Encapsulates off-route state, reroute status, candidate comparison metrics,
 * arrival progression, and audio mute state.
 */

import { createContext } from 'react';
import type { RouteComparison, OffRouteStatus, RerouteState } from '../rerouting/types';
import type { ArrivalStage } from '../engine/arrivalDetector';

export interface NavigationDiagnosticsContextValue {
  readonly offRouteStatus: OffRouteStatus;
  readonly rerouteStatus: RerouteState;
  readonly latestComparison: RouteComparison | null;
  readonly arrivalStage: ArrivalStage;
  readonly isMuted: boolean;
}

export const NavigationDiagnosticsContext = createContext<NavigationDiagnosticsContextValue | null>(null);
