/**
 * rerouting.test.ts
 *
 * Unit tests for RouteMatcher, OffRouteDetector, RouteRecovery,
 * ComparisonEngine, and RerouteManager.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { NavigationCoordinate } from '../models';
import type { LocationSample } from '../location/types';
import { RouteMatcher, projectPointToSegment } from '../rerouting/RouteMatcher';
import { OffRouteDetector } from '../rerouting/OffRouteDetector';
import { RouteRecovery } from '../rerouting/RouteRecovery';
import { ComparisonEngine } from '../rerouting/ComparisonEngine';
import { DEFAULT_NAVIGATION_THRESHOLDS } from '../rerouting/config';
import type { NavigationRoute } from '../models';
import type { ScoredRoute } from '../../hooks/useFindRoutes';

const sampleRoute: NavigationCoordinate[] = [
  { lat: 18.9220, lon: 72.8347 }, // Colaba Causeway Start
  { lat: 18.9250, lon: 72.8347 }, // Segment 0 (Straight North ~333m)
  { lat: 18.9250, lon: 72.8380 }, // Segment 1 (Turn East ~347m)
  { lat: 18.9300, lon: 72.8380 }, // Segment 2 (Turn North ~555m)
];

function createMockSample(overrides: Partial<LocationSample>): LocationSample {
  return {
    latitude: 18.9220,
    longitude: 72.8347,
    accuracy: 5,
    altitude: 10,
    heading: 0,
    speed: 1.2,
    source: 'gps',
    timestamp: Date.now(),
    ...overrides,
  };
}

test('RouteMatcher: projectPointToSegment projects orthogonal point correctly', () => {
  // Line from (18.9220, 72.8347) to (18.9250, 72.8347) - along longitude 72.8347
  // Query point at (18.9235, 72.8350) - east of line by 0.0003 deg (~31m)
  const proj = projectPointToSegment(
    18.9235, 72.8350,
    18.9220, 72.8347,
    18.9250, 72.8347
  );

  // Projected lat should be ~18.9235, projected lon should be exact 72.8347
  assert.ok(Math.abs(proj.lat - 18.9235) < 0.0001);
  assert.ok(Math.abs(proj.lon - 72.8347) < 0.00001);
  assert.ok(proj.fraction > 0.4 && proj.fraction < 0.6);
});

test('RouteMatcher: identifies nearest segment and calculates accurate perpendicular distance', () => {
  const matcher = new RouteMatcher(DEFAULT_NAVIGATION_THRESHOLDS);
  const location = createMockSample({
    latitude: 18.9235,
    longitude: 72.8350,
    accuracy: 5,
    speed: 1.2,
  });

  const match = matcher.match(sampleRoute, location, 0, { degrees: 0, source: 'gps' });

  assert.equal(match.nearestSegmentIndex, 0);
  assert.ok(match.perpendicularDistanceM > 25 && match.perpendicularDistanceM < 38);
  assert.ok(match.progressAlongRouteM > 150 && match.progressAlongRouteM < 180);
  assert.equal(match.segmentBearingDeg, 0); // North
  assert.equal(match.headingDivergenceDeg, 0);
});

test('RouteMatcher: detects user on-route when distance <= 25m', () => {
  const matcher = new RouteMatcher(DEFAULT_NAVIGATION_THRESHOLDS);
  const location = createMockSample({
    latitude: 18.9235,
    longitude: 72.8348, // ~10.5m from route
    accuracy: 5,
    speed: 1.2,
  });

  const match = matcher.match(sampleRoute, location, 0);
  assert.equal(match.isOnRoute, true);
  assert.ok(match.perpendicularDistanceM <= 25);
});

test('RouteMatcher: calculates heading divergence correctly when user walks away', () => {
  const matcher = new RouteMatcher(DEFAULT_NAVIGATION_THRESHOLDS);
  const location = createMockSample({
    latitude: 18.9235,
    longitude: 72.8350,
    accuracy: 5,
    speed: 1.4,
  });

  // Route segment 0 bearing is 0 (North). User heading is 90 (East - walking away).
  const match = matcher.match(sampleRoute, location, 0, { degrees: 90, source: 'compass' });
  assert.equal(match.headingDivergenceDeg, 90);
});

test('OffRouteDetector: ignores false positives when GPS uncertainty matches distance', () => {
  const matcher = new RouteMatcher(DEFAULT_NAVIGATION_THRESHOLDS);
  const detector = new OffRouteDetector(DEFAULT_NAVIGATION_THRESHOLDS);

  // User is 32m away, but GPS accuracy is 35m (urban canyon jitter)
  const location = createMockSample({
    latitude: 18.9235,
    longitude: 72.8350,
    accuracy: 35,
    speed: 1.0,
  });

  const match = matcher.match(sampleRoute, location, 0);
  const evalResult = detector.evaluate(match, location, 1000);

  assert.equal(evalResult.status, 'ON_ROUTE');
  assert.ok(evalResult.reason.includes('accuracy uncertainty'));
});

test('OffRouteDetector: does not confirm off-route on first single sample', () => {
  const matcher = new RouteMatcher(DEFAULT_NAVIGATION_THRESHOLDS);
  const detector = new OffRouteDetector(DEFAULT_NAVIGATION_THRESHOLDS);

  // User steps 32m away with good 5m GPS accuracy
  const location = createMockSample({
    latitude: 18.9235,
    longitude: 72.8350,
    accuracy: 5,
    speed: 1.0,
  });

  const match = matcher.match(sampleRoute, location, 0);
  const evalResult = detector.evaluate(match, location, 1000);

  // Must NOT confirm immediately on sample 1
  assert.equal(evalResult.status, 'OFF_ROUTE_POTENTIAL');
  assert.equal(evalResult.consecutiveCount, 1);
});

test('OffRouteDetector: confirms off-route after consecutive count and time window', () => {
  const matcher = new RouteMatcher(DEFAULT_NAVIGATION_THRESHOLDS);
  const detector = new OffRouteDetector(DEFAULT_NAVIGATION_THRESHOLDS);

  const loc1 = createMockSample({ latitude: 18.9235, longitude: 72.8350, accuracy: 5, speed: 1.0 });
  const loc2 = createMockSample({ latitude: 18.9235, longitude: 72.8352, accuracy: 5, speed: 1.0 });
  const loc3 = createMockSample({ latitude: 18.9235, longitude: 72.8354, accuracy: 5, speed: 1.0 });

  // Sample 1 at t=0
  const eval1 = detector.evaluate(matcher.match(sampleRoute, loc1, 0), loc1, 0);
  assert.equal(eval1.status, 'OFF_ROUTE_POTENTIAL');

  // Sample 2 at t=4s
  const eval2 = detector.evaluate(matcher.match(sampleRoute, loc2, 0), loc2, 4000);
  assert.equal(eval2.status, 'OFF_ROUTE_POTENTIAL');

  // Sample 3 at t=9s (satisfies both count >= 3 and time >= 8s)
  const eval3 = detector.evaluate(matcher.match(sampleRoute, loc3, 0), loc3, 9000);
  assert.equal(eval3.status, 'OFF_ROUTE_CONFIRMED');
  assert.equal(eval3.consecutiveCount, 3);
});

test('OffRouteDetector: confirms immediately on critical divergence distance (>65m)', () => {
  const matcher = new RouteMatcher(DEFAULT_NAVIGATION_THRESHOLDS);
  const detector = new OffRouteDetector(DEFAULT_NAVIGATION_THRESHOLDS);

  // Far coordinate > 70m away
  const farLoc = createMockSample({
    latitude: 18.9235,
    longitude: 72.8356, // ~95m from route
    accuracy: 5,
    speed: 1.5,
  });

  // Sample 1
  detector.evaluate(matcher.match(sampleRoute, farLoc, 0), farLoc, 0);
  // Sample 2 moving away
  const evalCritical = detector.evaluate(matcher.match(sampleRoute, farLoc, 0), farLoc, 2000);

  assert.equal(evalCritical.status, 'OFF_ROUTE_CONFIRMED');
  assert.ok(evalCritical.reason.includes('Critical divergence'));
});

test('RouteRecovery: detects recovery when user returns to route corridor', () => {
  const matcher = new RouteMatcher(DEFAULT_NAVIGATION_THRESHOLDS);
  const detector = new OffRouteDetector(DEFAULT_NAVIGATION_THRESHOLDS);
  const recovery = new RouteRecovery(DEFAULT_NAVIGATION_THRESHOLDS);

  // 1. User drifts off-route
  const offLoc = createMockSample({ latitude: 18.9235, longitude: 72.8351, accuracy: 5 });
  const evalOff = detector.evaluate(matcher.match(sampleRoute, offLoc, 0), offLoc, 0);
  recovery.trackStatus(evalOff.status);

  // 2. User walks back onto the route (dist <= 15m)
  const backLoc = createMockSample({ latitude: 18.9235, longitude: 72.8348, accuracy: 5 });
  const matchBack = matcher.match(sampleRoute, backLoc, 0);
  const recoveryResult = recovery.evaluateRecovery(matchBack, detector);

  assert.equal(recoveryResult.isRecovered, true);
  assert.equal(detector.getStatus(), 'ON_ROUTE');
});

test('ComparisonEngine: calculates positive comfort score and shade deltas', () => {
  const engine = new ComparisonEngine(DEFAULT_NAVIGATION_THRESHOLDS);

  const mockCurrentRoute = {
    id: 'current_1',
    title: 'Current Route',
    destination_name: 'Gateway of India',
    distance_m: 800,
    duration_min: 10,
    avg_shade_pct: 45,
    feels_like_c: 32,
    overall_score: 0.60,
    geometry: sampleRoute,
    steps: [],
    raw_route: {} as any,
  } as unknown as NavigationRoute;

  const mockCandidateScored: ScoredRoute = {
    rank: 1,
    overall_score: 0.72, // +20%
    avg_shade_pct: 60, // +15%
    feels_like_c: 30,
    shade_safety_score: 0.8,
    heat_safety_score: 0.7,
    crowd_safety_score: null,
    shade_segments: [0.6, 0.6],
    shade_sources: ['overpass'],
    segment_distances_m: [400, 350],
    path: [{ lat: 18.9235, lon: 72.8350 }, { lat: 18.9300, lon: 72.8380 }],
    segment_count: 2,
    distance_m: 750,
    duration_min: 9, // -1 min
  };

  const comp = engine.compareRoutes(mockCurrentRoute, mockCandidateScored);

  assert.equal(comp.isCooler, true);
  assert.equal(comp.scoreDeltaPct, 20);
  assert.equal(comp.shadeDeltaPct, 15);
  assert.equal(comp.durationDeltaMin, -1);
  assert.ok(comp.summaryText.includes('+20% cooler'));
  assert.ok(comp.summaryText.includes('1 min shorter'));
  assert.equal(engine.isMeaningfulImprovement(comp), true);
});



