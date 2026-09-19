/**
 * RerouteManager.ts
 *
 * Orchestrates intelligent pedestrian rerouting with backend comfort rescoring.
 * Enforces cooldown throttling, single in-flight request management, destination
 * immutability, network failure resilience, and dynamic environmental rescoring.
 */

import type { RoutesResult, ScoredRoute } from '../../hooks/useFindRoutes';
import type { LocationSample } from '../location/types';
import type { NavigationCoordinate, NavigationRoute, NavigationSession } from '../models';
import { buildNavigationRoute } from '../utils/sessionBuilder';
import { ComparisonEngine } from './ComparisonEngine';
import { DEFAULT_NAVIGATION_THRESHOLDS, type NavigationThresholds } from './config';
import type { RerouteRecord, RerouteState, RouteComparison } from './types';

export type RouteFetchFunction = (
  startLat: number,
  startLon: number,
  endLat: number,
  endLon: number,
  signal?: AbortSignal
) => Promise<RoutesResult>;

/**
 * Default HTTP fetcher for backend /find-routes/ endpoint.
 * Works seamlessly in Node, Web, and React Native without circular dependencies.
 */
export async function defaultRouteFetcher(
  startLat: number,
  startLon: number,
  endLat: number,
  endLon: number,
  signal?: AbortSignal
): Promise<RoutesResult> {
  const apiBase = process.env.EXPO_PUBLIC_API_URL?.trim() || 'http://localhost:8000';
  const response = await fetch(`${apiBase}/find-routes/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    signal,
    body: JSON.stringify({
      start: { lat: startLat, lon: startLon },
      end: { lat: endLat, lon: endLon },
      n_routes: 2,
    }),
  });

  if (!response.ok) {
    throw new Error(`Server error ${response.status}`);
  }
  return response.json() as Promise<RoutesResult>;
}

export interface RerouteSuccessResult {
  readonly success: true;
  readonly updatedRoute: NavigationRoute;
  readonly comparison: RouteComparison;
  readonly rerouteRecord: RerouteRecord;
}

export interface RerouteFailureResult {
  readonly success: false;
  readonly error: string;
  readonly fallbackRoute: NavigationRoute;
}

export type RerouteExecutionResult = RerouteSuccessResult | RerouteFailureResult;

export class RerouteManager {
  private readonly thresholds: NavigationThresholds;
  private readonly comparisonEngine: ComparisonEngine;
  private readonly fetchRoutes: RouteFetchFunction;

  private state: RerouteState = 'IDLE';
  private lastRerouteCompletedTimestampMs: number = 0;
  private activeAbortController: AbortController | null = null;
  private rerouteCount: number = 0;
  private readonly rerouteHistory: RerouteRecord[] = [];

  constructor(
    thresholds: NavigationThresholds = DEFAULT_NAVIGATION_THRESHOLDS,
    comparisonEngine: ComparisonEngine = new ComparisonEngine(thresholds),
    fetchRoutes: RouteFetchFunction = defaultRouteFetcher
  ) {
    this.thresholds = thresholds;
    this.comparisonEngine = comparisonEngine;
    this.fetchRoutes = fetchRoutes;
  }

  /**
   * Checks whether rerouting is permitted under the cooldown policy and current state.
   */
  public canReroute(nowMs: number = Date.now()): boolean {
    if (this.state === 'REQUESTING') {
      return false; // Request already in flight
    }

    if (this.lastRerouteCompletedTimestampMs === 0) {
      return true; // No previous reroute has executed yet
    }

    const elapsedSinceLastReroute = (nowMs - this.lastRerouteCompletedTimestampMs) / 1000;
    return elapsedSinceLastReroute >= this.thresholds.REROUTE_COOLDOWN_SECONDS;
  }

  /**
   * Returns seconds remaining in the reroute cooldown period.
   */
  public getCooldownRemainingSeconds(nowMs: number = Date.now()): number {
    if (this.lastRerouteCompletedTimestampMs === 0) {
      return 0;
    }
    const elapsed = (nowMs - this.lastRerouteCompletedTimestampMs) / 1000;
    return Math.max(0, Math.ceil(this.thresholds.REROUTE_COOLDOWN_SECONDS - elapsed));
  }

  /**
   * Executes a reroute request to the authoritative backend.
   * Preserves the original destination coordinate and name.
   */
  public async executeReroute(
    session: NavigationSession,
    currentLocation: LocationSample,
    triggerReason: string = 'Off-route confirmed',
    nowMs: number = Date.now()
  ): Promise<RerouteExecutionResult> {
    // 1. Throttle check
    if (!this.canReroute(nowMs)) {
      return {
        success: false,
        error: `Reroute throttled: cooldown active (${this.getCooldownRemainingSeconds(nowMs)}s remaining).`,
        fallbackRoute: session.route,
      };
    }

    // 2. Abort any previous stale request
    this.cancelInFlight();

    const abortController = new AbortController();
    this.activeAbortController = abortController;
    this.state = 'REQUESTING';

    const currentRoute = session.route;
    const geometry = currentRoute.geometry;

    if (geometry.length === 0) {
      this.state = 'FAILED';
      return {
        success: false,
        error: 'Cannot reroute: route geometry is empty.',
        fallbackRoute: currentRoute,
      };
    }

    // IMMUTABILITY: Destination coordinate and name NEVER change
    const destinationCoord = geometry[geometry.length - 1];
    const destinationName = currentRoute.destination_name;

    const startLat = currentLocation.latitude;
    const startLon = currentLocation.longitude;
    const endLat = destinationCoord.lat;
    const endLon = destinationCoord.lon;

    try {
      // 3. Call authoritative backend POST /find-routes/
      const result: RoutesResult = await this.fetchRoutes(
        startLat,
        startLon,
        endLat,
        endLon,
        abortController.signal
      );

      if (!result.routes || result.routes.length === 0) {
        throw new Error('Backend returned 0 viable pedestrian routes from current location.');
      }

      // Rank 1 route represents the coolest path from current position
      const bestCandidate: ScoredRoute = result.routes[0];

      // 4. Compare old route vs new route
      this.state = 'COMPARING';
      const comparison = this.comparisonEngine.compareRoutes(currentRoute, bestCandidate);

      // 5. Build new NavigationRoute with updated steps and geometry
      const updatedRoute = buildNavigationRoute(
        bestCandidate,
        destinationName,
        `Coolest Path (Reroute #${this.rerouteCount + 1})`
      );

      const rerouteRecord: RerouteRecord = {
        timestamp: nowMs,
        triggerReason,
        fromCoordinate: { lat: startLat, lon: startLon },
        toCoordinate: destinationCoord,
        oldRouteId: currentRoute.id,
        newRouteId: updatedRoute.id,
        comparison,
      };

      this.rerouteCount += 1;
      this.rerouteHistory.push(rerouteRecord);
      this.lastRerouteCompletedTimestampMs = nowMs;
      this.state = 'IDLE';

      return {
        success: true,
        updatedRoute,
        comparison,
        rerouteRecord,
      };
    } catch (err: unknown) {
      if (abortController.signal.aborted) {
        this.state = 'IDLE';
        return {
          success: false,
          error: 'Reroute request was cancelled.',
          fallbackRoute: currentRoute,
        };
      }

      this.state = 'FAILED';
      const errorMsg = err instanceof Error ? err.message : String(err);

      // FAILURE RESILIENCE: Never crash or end navigation unexpectedly!
      // Return fallback to existing route.
      return {
        success: false,
        error: `Reroute failed (${errorMsg}). Continuing on current route.`,
        fallbackRoute: currentRoute,
      };
    } finally {
      if (this.activeAbortController === abortController) {
        this.activeAbortController = null;
      }
    }
  }

  /**
   * Cancels in-flight reroute request (e.g. if user recovers or manually cancels).
   */
  public cancelInFlight(): void {
    if (this.activeAbortController) {
      this.activeAbortController.abort();
      this.activeAbortController = null;
    }
    if (this.state === 'REQUESTING' || this.state === 'COMPARING') {
      this.state = 'IDLE';
    }
  }

  public getState(): RerouteState {
    return this.state;
  }

  public getRerouteCount(): number {
    return this.rerouteCount;
  }

  public getRerouteHistory(): readonly RerouteRecord[] {
    return this.rerouteHistory;
  }

  public reset(): void {
    this.cancelInFlight();
    this.state = 'IDLE';
    this.lastRerouteCompletedTimestampMs = 0;
    this.rerouteCount = 0;
    this.rerouteHistory.length = 0;
  }
}
