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
import { DEFAULT_NAVIGATION_THRESHOLDS } from '../rerouting/config';

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

