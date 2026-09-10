import type { ScoredRoute } from '../../hooks/useFindRoutes';
import type {
  NavigationCoordinate,
  NavigationProgress,
  NavigationRoute,
  NavigationSession,
  NavigationStep,
} from '../models';

let sessionCounter = 0;

export function generateSessionId(): string {
  sessionCounter += 1;
  return `nav_session_${Date.now()}_${sessionCounter}`;
}

/**
 * Builds a strongly typed NavigationStep list from route path and segments.
 */
export function buildNavigationSteps(
  path: readonly NavigationCoordinate[],
  segmentDistances: readonly number[],
  shadeSegments: readonly (number | null)[],
  destinationName: string
): readonly NavigationStep[] {
  if (path.length === 0) {
    return [];
  }

  if (path.length === 1) {
    const single = path[0];
    return [
      {
        index: 0,
        instruction: `Arrive at ${destinationName}`,
        distance_m: 0,
        duration_s: 0,
        shade_pct: 100,
        start_location: single,
        end_location: single,
        name: destinationName,
      },
    ];
  }

  const steps: NavigationStep[] = [];
  const count = path.length - 1;

  for (let i = 0; i < count; i += 1) {
    const startLoc = path[i];
    const endLoc = path[i + 1];
    const dist = segmentDistances[i] ?? 0;
    const durationSeconds = Math.max(1, Math.round(dist / 1.33)); // ~80m/min = 1.33 m/s pedestrian speed
    const shadePct = shadeSegments[i] ?? null;

    let instruction: string;
    if (i === 0) {
      instruction = `Head toward ${destinationName}`;
    } else if (i === count - 1) {
      instruction = `Arrive at ${destinationName}`;
    } else {
      instruction = shadePct && shadePct > 50
        ? 'Continue along shaded path'
        : 'Continue along route';
    }

    steps.push({
      index: i,
      instruction,
      distance_m: dist,
      duration_s: durationSeconds,
      shade_pct: shadePct,
      start_location: startLoc,
      end_location: endLoc,
      name: i === count - 1 ? destinationName : undefined,
    });
  }

  return steps;
}

/**
 * Builds a normalized NavigationRoute from an existing ScoredRoute.
 */
export function buildNavigationRoute(
  scoredRoute: ScoredRoute,
  destinationName: string,
  title?: string
): NavigationRoute {
  const totalDistance = Math.round(
    scoredRoute.distance_m ??
      scoredRoute.segment_distances_m.reduce((acc, curr) => acc + curr, 0)
  );

  const durationMin =
    scoredRoute.duration_min ?? Math.max(1, Math.round(totalDistance / 80));

  const geometry: NavigationCoordinate[] = (scoredRoute.path ?? []).map((pt) => ({
    lat: pt.lat,
    lon: pt.lon,
  }));

  const steps = buildNavigationSteps(
    geometry,
    scoredRoute.segment_distances_m ?? [],
    scoredRoute.shade_segments ?? [],
    destinationName
  );

  return {
    id: `route_${scoredRoute.rank}_${Date.now()}`,
    title: title ?? (scoredRoute.rank === 1 ? 'Coolest Route' : 'Alternate Route'),
    destination_name: destinationName,
    distance_m: totalDistance,
    duration_min: durationMin,
    avg_shade_pct: scoredRoute.avg_shade_pct,
    feels_like_c: scoredRoute.feels_like_c,
    overall_score: scoredRoute.overall_score,
    geometry,
    steps,
    raw_route: scoredRoute,
  };
}

/**
 * Creates an initial NavigationSession in the READY state.
 */
export function createNavigationSession(
  scoredRoute: ScoredRoute,
  destinationName: string,
  title?: string
): NavigationSession {
  const route = buildNavigationRoute(scoredRoute, destinationName, title);
  const now = new Date().toISOString();

  const progress: NavigationProgress = {
    current_step_index: 0,
    total_steps: route.steps.length,
    distance_traveled_m: 0,
    remaining_distance_m: route.distance_m,
    fraction_completed: 0,
    elapsed_duration_s: 0,
    remaining_duration_s: route.duration_min * 60,
  };

  return {
    id: generateSessionId(),
    route,
    route_geometry: route.geometry,
    steps: route.steps,
    started_at: null,
    created_at: now,
    status: 'READY',
    progress,
    paused: false,
    completed: false,
    current_step_index: 0,
    total_distance_m: route.distance_m,
    remaining_distance_m: route.distance_m,
    estimated_duration_s: route.duration_min * 60,
    remaining_duration_s: route.duration_min * 60,
  };
}
