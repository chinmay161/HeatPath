/**
 * geoUtils.test.ts
 *
 * Unit tests for authoritative shared geometry utilities (Task 4 / MED-1).
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  projectPointToSegment,
  perpendicularDistance,
  interpolatePoint,
  calculatePolylineDistanceMeters,
  segmentProgress,
} from '../utils/geo';
import type { NavigationCoordinate } from '../models';

test('geo: projectPointToSegment projects orthogonal point onto segment with equirectangular scaling', () => {
  // Line segment along latitude 12.9716 (approx Bangalore)
  const a = { lat: 12.9716, lon: 77.5946 };
  const b = { lat: 12.9716, lon: 77.5966 };

  // Point perpendicular to segment midpoint
  const p = { lat: 12.9726, lon: 77.5956 };

  const proj = projectPointToSegment(p.lat, p.lon, a.lat, a.lon, b.lat, b.lon);

  assert.equal(proj.lat, 12.9716);
  assert.ok(Math.abs(proj.lon - 77.5956) < 1e-6);
  assert.ok(Math.abs(proj.fraction - 0.5) < 0.01);
});

test('geo: projectPointToSegment clamps beyond segment endpoints', () => {
  const a = { lat: 12.0, lon: 77.0 };
  const b = { lat: 12.0, lon: 77.002 };

  // Point before start
  const beforeP = { lat: 12.0, lon: 76.998 };
  const projBefore = projectPointToSegment(beforeP.lat, beforeP.lon, a.lat, a.lon, b.lat, b.lon);
  assert.equal(projBefore.fraction, 0);
  assert.equal(projBefore.lon, a.lon);

  // Point after end
  const afterP = { lat: 12.0, lon: 77.005 };
  const projAfter = projectPointToSegment(afterP.lat, afterP.lon, a.lat, a.lon, b.lat, b.lon);
  assert.equal(projAfter.fraction, 1);
  assert.equal(projAfter.lon, b.lon);
});

test('geo: projectPointToSegment handles zero-length segments safely', () => {
  const a = { lat: 12.5, lon: 77.5 };
  const proj = projectPointToSegment(12.6, 77.6, a.lat, a.lon, a.lat, a.lon);
  assert.equal(proj.lat, a.lat);
  assert.equal(proj.lon, a.lon);
  assert.equal(proj.fraction, 0);
});

test('geo: perpendicularDistance calculates accurate distance in meters', () => {
  // Segment of 100m length
  const a = { lat: 12.9716, lon: 77.5946 };
  const b = { lat: 12.9716, lon: 77.5966 };

  // Point exactly on the segment has 0 perpendicular distance
  const distOn = perpendicularDistance(12.9716, 77.5956, a.lat, a.lon, b.lat, b.lon);
  assert.ok(distOn < 1.0); // Within 1 meter tolerance

  // Point 50m north
  const distAway = perpendicularDistance(12.97205, 77.5956, a.lat, a.lon, b.lat, b.lon);
  assert.ok(distAway > 40 && distAway < 60);
});

test('geo: interpolatePoint interpolates coordinate accurately', () => {
  const a: NavigationCoordinate = { lat: 10.0, lon: 20.0 };
  const b: NavigationCoordinate = { lat: 20.0, lon: 30.0 };

  const mid = interpolatePoint(a, b, 0.5);
  assert.equal(mid.lat, 15.0);
  assert.equal(mid.lon, 25.0);

  const start = interpolatePoint(a, b, -0.2); // Clamped
  assert.equal(start.lat, 10.0);

  const end = interpolatePoint(a, b, 1.5); // Clamped
  assert.equal(end.lat, 20.0);
});

test('geo: calculatePolylineDistanceMeters computes cumulative distance', () => {
  const empty: NavigationCoordinate[] = [];
  assert.equal(calculatePolylineDistanceMeters(empty), 0);

  const single: NavigationCoordinate[] = [{ lat: 12.0, lon: 77.0 }];
  assert.equal(calculatePolylineDistanceMeters(single), 0);

  const route: NavigationCoordinate[] = [
    { lat: 12.9716, lon: 77.5946 },
    { lat: 12.9726, lon: 77.5946 }, // ~111m
    { lat: 12.9736, lon: 77.5946 }, // ~111m
  ];
  const dist = calculatePolylineDistanceMeters(route);
  assert.ok(dist > 200 && dist < 240);
});

test('geo: segmentProgress computes accurate progress and remaining distance', () => {
  const polyline: NavigationCoordinate[] = [
    { lat: 12.9700, lon: 77.5900 },
    { lat: 12.9710, lon: 77.5900 },
    { lat: 12.9720, lon: 77.5900 },
  ];

  // User at midpoint of segment 0
  const progress = segmentProgress(polyline, 12.9705, 77.5900);
  assert.equal(progress.nearestIndex, 0);
  assert.ok(Math.abs(progress.fraction - 0.5) < 0.05);
  assert.ok(progress.progressM > 50 && progress.progressM < 60);
  assert.ok(progress.remainingM > 160 && progress.remainingM < 175);
});
