/**
 * stateEvaluator.test.ts
 *
 * Unit tests verifying pure state evaluation without side-effects (Task 1 / CRIT-4).
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateNavigationState } from '../provider/stateEvaluator';
import { RouteMatcher } from '../rerouting/RouteMatcher';
import { ArrivalTracker } from '../engine/arrivalDetector';
import { RouteRecovery } from '../rerouting/RouteRecovery';
import { OffRouteDetector } from '../rerouting/OffRouteDetector';
import type { NavigationSession } from '../models';
import type { LocationSample, Heading, SpeedEstimate } from '../location';

function createMockSession(): NavigationSession {
  return {
    id: 'eval_session_1',
    route: {
      id: 'route_1',
      title: 'Cool Walk',
      destination_name: 'Vidhana Soudha',
      distance_m: 600,
      duration_min: 8,
      avg_shade_pct: 70,
      feels_like_c: 29,
      overall_score: 0.85,
      geometry: [
        { lat: 12.9790, lon: 77.5900 },
        { lat: 12.9795, lon: 77.5910 },
        { lat: 12.9800, lon: 77.5920 },
      ],
      steps: [
        {
          index: 0,
          instruction: 'Head east',
          start_location: { lat: 12.9790, lon: 77.5900 },
          end_location: { lat: 12.9795, lon: 77.5910 },
          distance_m: 130,
          duration_s: 90,
          maneuver_type: 'depart',
          shade_pct: 70,
        },
        {
          index: 1,
          instruction: 'Turn right',
          start_location: { lat: 12.9795, lon: 77.5910 },
          end_location: { lat: 12.9800, lon: 77.5920 },
          distance_m: 130,
          duration_s: 90,
          maneuver_type: 'turn_right',
          shade_pct: 70,
        },
      ],
      raw_route: {} as any,
    },
    route_geometry: [
      { lat: 12.9790, lon: 77.5900 },
      { lat: 12.9795, lon: 77.5910 },
      { lat: 12.9800, lon: 77.5920 },
    ],
    steps: [],
    started_at: '2026-09-19T09:00:00.000Z',
    created_at: '2026-09-19T09:00:00.000Z',
    status: 'NAVIGATING',
    progress: {
      current_step_index: 0,
      total_steps: 2,
      distance_traveled_m: 0,
      remaining_distance_m: 260,
      fraction_completed: 0,
      elapsed_duration_s: 0,
      remaining_duration_s: 180,
    },
    paused: false,
    completed: false,
    current_step_index: 0,
    total_distance_m: 260,
    remaining_distance_m: 260,
    estimated_duration_s: 180,
    remaining_duration_s: 180,
  };
}

const mockHeading: Heading = { degrees: 60, source: 'gps' };
const mockSpeed: SpeedEstimate = {
  currentSpeedMps: 1.4,
  averageSpeedMps: 1.4,
  walkingSpeedKmph: 5.0,
  isEstimated: false,
};

test('stateEvaluator: evaluateNavigationState computes next session purely', () => {
  const session = createMockSession();
  const routeMatcher = new RouteMatcher();
  const arrivalTracker = new ArrivalTracker();
  const routeRecovery = new RouteRecovery();
  const offRouteDetector = new OffRouteDetector();

  const loc: LocationSample = {
    latitude: 12.9792,
    longitude: 77.5905,
    accuracy: 4,
    altitude: null,
    heading: 60,
    speed: 1.4,
    timestamp: Date.now(),
    source: 'gps',
  };

  const result = evaluateNavigationState(
    session,
    loc,
    mockHeading,
    mockSpeed,
    routeMatcher,
    arrivalTracker,
    routeRecovery,
    offRouteDetector
  );

  // Original session object must remain untouched (purity)
  assert.equal(session.progress.distance_traveled_m, 0);

  // New session object constructed
  assert.ok(result.nextSession);
  assert.notEqual(result.nextSession, session);
  assert.equal(result.nextSession.status, 'NAVIGATING');
  assert.ok(result.nextSession.progress.distance_traveled_m > 0);
  assert.equal(result.nextSession.current_location, loc);
  assert.equal(result.nextSession.current_speed, mockSpeed);
  assert.equal(result.offRouteEval.status, 'ON_ROUTE');
  assert.ok(result.match.isOnRoute);
});

test('stateEvaluator: transitions status to ARRIVED when within destination threshold', () => {
  const session = createMockSession();
  const routeMatcher = new RouteMatcher();
  const arrivalTracker = new ArrivalTracker();
  const routeRecovery = new RouteRecovery();
  const offRouteDetector = new OffRouteDetector();

  // Location within 5m of destination (12.9800, 77.5920)
  const arrivalLoc: LocationSample = {
    latitude: 12.98001,
    longitude: 77.59201,
    accuracy: 3,
    altitude: null,
    heading: 60,
    speed: 0.5,
    timestamp: Date.now(),
    source: 'gps',
  };

  const result = evaluateNavigationState(
    session,
    arrivalLoc,
    mockHeading,
    mockSpeed,
    routeMatcher,
    arrivalTracker,
    routeRecovery,
    offRouteDetector
  );

  assert.equal(result.nextSession.status, 'ARRIVED');
  assert.equal(result.arrivalEval?.hasArrived, true);
  assert.equal(result.arrivalEval?.stage, 'ARRIVED');
});
