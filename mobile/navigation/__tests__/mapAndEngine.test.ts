import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  normalizeAngleDelta,
  classifyTurnManeuver,
  deriveManeuverAtVertex,
} from '../engine/maneuvers';
import {
  evaluateArrival,
  DEFAULT_ARRIVAL_THRESHOLD_METERS,
} from '../engine/arrivalDetector';
import {
  calculateRouteStats,
  PEDESTRIAN_DEFAULT_SPEED_MPS,
} from '../engine/etaCalculator';
import {
  evaluateRouteProgress,
  calculatePolylineDistanceMeters,
} from '../map/ProgressRenderer';
import { calculateRouteBounds } from '../map/RouteFit';
import { CameraController } from '../map/CameraController';
import { getMapLibreStyle, TILE_PROVIDERS } from '../map/TileProvider';
import { createAccuracyCirclePolygon } from '../map/UserLocationRenderer';
import type { NavigationCoordinate } from '../models';
import type { LocationSample } from '../location/types';

// Mock route coordinates
const mockRoute: NavigationCoordinate[] = [
  { lat: 12.971598, lon: 77.594562 }, // Origin
  { lat: 12.972598, lon: 77.594562 }, // Segment 1: Heading North (0 deg)
  { lat: 12.972598, lon: 77.596562 }, // Segment 2: Turn Right (90 deg)
  { lat: 12.974598, lon: 77.596562 }, // Segment 3: Turn Left (0 deg)
];

test('Maneuvers: normalizeAngleDelta keeps angles in (-180, +180]', () => {
  assert.equal(normalizeAngleDelta(0), 0);
  assert.equal(normalizeAngleDelta(90), 90);
  assert.equal(normalizeAngleDelta(270), -90);
  assert.equal(normalizeAngleDelta(-270), 90);
  assert.equal(normalizeAngleDelta(360), 0);
  assert.equal(normalizeAngleDelta(180), 180);
  assert.equal(normalizeAngleDelta(-180), 180);
});

test('Maneuvers: classifyTurnManeuver identifies standard turns correctly', () => {
  assert.equal(classifyTurnManeuver(0).type, 'straight');
  assert.equal(classifyTurnManeuver(10).type, 'straight');
  assert.equal(classifyTurnManeuver(30).type, 'slight-right');
  assert.equal(classifyTurnManeuver(85).type, 'right');
  assert.equal(classifyTurnManeuver(145).type, 'sharp-right');
  assert.equal(classifyTurnManeuver(180).type, 'u-turn');
  assert.equal(classifyTurnManeuver(-30).type, 'slight-left');
  assert.equal(classifyTurnManeuver(-90).type, 'left');
  assert.equal(classifyTurnManeuver(-145).type, 'sharp-left');
});

test('Maneuvers: deriveManeuverAtVertex generates proper departure, intermediate turns, and arrival', () => {
  const destName = 'Cubbon Park';

  // 1. Departure
  const depart = deriveManeuverAtVertex(mockRoute, 0, destName);
  assert.equal(depart.type, 'depart');
  assert.match(depart.instruction, /Head toward Cubbon Park/);

  // 2. Vertex 1 (North -> East = Turn Right)
  const turnRight = deriveManeuverAtVertex(mockRoute, 1, destName);
  assert.equal(turnRight.type, 'right');
  assert.match(turnRight.instruction, /Turn right/);

  // 3. Vertex 2 (East -> North = Turn Left)
  const turnLeft = deriveManeuverAtVertex(mockRoute, 2, destName);
  assert.equal(turnLeft.type, 'left');
  assert.match(turnLeft.instruction, /Turn left/);

  // 4. Arrival
  const arrive = deriveManeuverAtVertex(mockRoute, 3, destName);
  assert.equal(arrive.type, 'arrive');
  assert.match(arrive.instruction, /Arrive at Cubbon Park/);
});

test('ArrivalDetector: detects arrival within 15m radius', () => {
  const dest: NavigationCoordinate = { lat: 12.975, lon: 77.595 };

  // 1. Exactly at destination (0m)
  const exactLocation: LocationSample = {
    latitude: 12.975,
    longitude: 77.595,
    accuracy: 5,
    altitude: null,
    heading: 0,
    speed: 1.2,
    timestamp: Date.now(),
    source: 'gps',
  };
  const res1 = evaluateArrival(exactLocation, dest, 15);
  assert.equal(res1.hasArrived, true);
  assert.equal(res1.distanceToDestinationM, 0);

  // 2. 10m away (inside 15m threshold)
  // ~0.00009 deg latitude is ~10m
  const nearLocation: LocationSample = {
    latitude: 12.97509,
    longitude: 77.595,
    accuracy: 4,
    altitude: null,
    heading: 0,
    speed: 1.0,
    timestamp: Date.now(),
    source: 'gps',
  };
  const res2 = evaluateArrival(nearLocation, dest, 15);
  assert.equal(res2.hasArrived, true);
  assert.ok(res2.distanceToDestinationM <= 15);

  // 3. 50m away (outside 15m threshold)
  const farLocation: LocationSample = {
    latitude: 12.9755,
    longitude: 77.595,
    accuracy: 5,
    altitude: null,
    heading: 0,
    speed: 1.3,
    timestamp: Date.now(),
    source: 'gps',
  };
  const res3 = evaluateArrival(farLocation, dest, 15);
  assert.equal(res3.hasArrived, false);
  assert.ok(res3.distanceToDestinationM > 15);

  // 4. Null location handling
  const resNull = evaluateArrival(null, dest);
  assert.equal(resNull.hasArrived, false);
});

test('ETACalculator: computes realistic walking ETA and elapsed duration', () => {
  const now = new Date('2026-09-19T10:00:00Z');
  const startedAt = new Date('2026-09-19T09:50:00Z').toISOString(); // 10 min ago

  const stats = calculateRouteStats({
    startedAt,
    totalDistanceM: 1000,
    walkedDistanceM: 500,
    remainingDistanceM: 500,
    currentSpeed: {
      currentSpeedMps: 1.25,
      averageSpeedMps: 1.25,
      walkingSpeedKmph: 4.5,
      isEstimated: false,
    },
    now,
  });

  assert.equal(stats.elapsedDurationS, 600); // 10 minutes
  assert.equal(stats.progressPct, 50); // 50%
  // 500m / 1.25 m/s = 400s
  assert.equal(stats.remainingDurationS, 400);
  assert.equal(
    stats.estimatedArrivalTime.getTime(),
    now.getTime() + 400 * 1000
  );
  // Pace: (10 min) / 0.5 km = 20 min/km
  assert.equal(stats.averagePaceMinPerKm, 20);
});

test('ETACalculator: falls back to pedestrian default speed when stationary', () => {
  const now = new Date('2026-09-19T10:00:00Z');
  const stats = calculateRouteStats({
    startedAt: null,
    totalDistanceM: 800,
    walkedDistanceM: 0,
    remainingDistanceM: 800,
    currentSpeed: {
      currentSpeedMps: 0,
      averageSpeedMps: 0,
      walkingSpeedKmph: 0,
      isEstimated: false,
    },
    now,
  });

  assert.equal(stats.effectiveSpeedMps, PEDESTRIAN_DEFAULT_SPEED_MPS);
  assert.equal(
    stats.remainingDurationS,
    Math.round(800 / PEDESTRIAN_DEFAULT_SPEED_MPS)
  );
  assert.equal(stats.progressPct, 0);
  assert.equal(stats.elapsedDurationS, 0);
});

test('ProgressRenderer: projects user location and splits completed vs remaining line strings', () => {
  // Test polyline distance
  const dist = calculatePolylineDistanceMeters(mockRoute);
  assert.ok(dist > 300, `Expected polyline distance > 300m, got ${dist}`);

  // User is halfway along segment 0 (midpoint between pt 0 and pt 1)
  const userLoc: LocationSample = {
    latitude: 12.972098,
    longitude: 77.594562,
    accuracy: 3,
    altitude: null,
    heading: 0,
    speed: 1.2,
    timestamp: Date.now(),
    source: 'gps',
  };

  const progress = evaluateRouteProgress(mockRoute, userLoc, 0);

  // Both completed and remaining must be valid GeoJSON LineStrings
  assert.equal(progress.completedGeoJSON.type, 'Feature');
  assert.equal(progress.completedGeoJSON.geometry.type, 'LineString');
  assert.equal(progress.remainingGeoJSON.type, 'Feature');
  assert.equal(progress.remainingGeoJSON.geometry.type, 'LineString');

  // Completed line has at least 2 points: [start, projected]
  assert.ok(progress.completedCoordinates.length >= 2);
  // Remaining line has at least 2 points: [projected, ..., end]
  assert.ok(progress.remainingCoordinates.length >= 2);

  // Traveled + remaining roughly matches total route distance
  const sumDist = progress.distanceTraveledM + progress.remainingDistanceM;
  assert.ok(
    Math.abs(sumDist - dist) < 5,
    `Difference between sum (${sumDist}) and total (${dist}) should be < 5m`
  );
});

test('RouteFit: computes valid bounding box enclosing coordinates', () => {
  const bounds = calculateRouteBounds(mockRoute);
  assert.ok(bounds !== null);
  assert.ok(bounds.ne[0] > bounds.sw[0], 'NE lon must be > SW lon');
  assert.ok(bounds.ne[1] > bounds.sw[1], 'NE lat must be > SW lat');
  assert.ok(bounds.center[0] >= bounds.sw[0] && bounds.center[0] <= bounds.ne[0]);
  assert.ok(bounds.center[1] >= bounds.sw[1] && bounds.center[1] <= bounds.ne[1]);
});

test('CameraController: transitions between Follow, Free Explore, and Recenter', () => {
  const controller = new CameraController('FOLLOW');
  assert.equal(controller.getMode(), 'FOLLOW');

  // User touches/drags map -> switches to FREE_EXPLORE
  controller.handleUserGesture();
  assert.equal(controller.getMode(), 'FREE_EXPLORE');

  // While in FREE_EXPLORE, location updates do not force camera view
  const userLoc: LocationSample = {
    latitude: 12.97,
    longitude: 77.59,
    accuracy: 5,
    altitude: null,
    heading: 45,
    speed: 1.2,
    timestamp: Date.now(),
    source: 'gps',
  };
  const viewUpdate = controller.computeLocationUpdateView(userLoc);
  assert.equal(viewUpdate, null);

  // User taps Recenter -> switches back to FOLLOW mode
  const recenterView = controller.recenter(userLoc, { degrees: 45, source: 'compass' });
  assert.equal(controller.getMode(), 'FOLLOW');
  assert.ok(recenterView !== null);
  assert.equal(recenterView.mode, 'FOLLOW');
  assert.equal(recenterView.centerCoordinate[0], userLoc.longitude);
  assert.equal(recenterView.centerCoordinate[1], userLoc.latitude);
  assert.equal(recenterView.heading, 45);
});

test('TileProvider: generates valid style specification JSON for OpenStreetMap raster tiles', () => {
  const style = getMapLibreStyle('OSM_RASTER') as any;
  assert.equal(style.version, 8);
  assert.ok(style.sources['raster-tiles']);
  assert.equal(style.sources['raster-tiles'].type, 'raster');
  assert.ok(style.sources['raster-tiles'].tiles.length > 0);
  assert.ok(style.layers.some((l: any) => l.type === 'raster'));
});

test('UserLocationRenderer: generates circular polygon for GPS accuracy', () => {
  const poly = createAccuracyCirclePolygon(12.9715, 77.5945, 18, 16);
  assert.equal(poly.type, 'Feature');
  assert.equal(poly.geometry.type, 'Polygon');
  // First and last coordinates of a polygon ring must match
  const ring = poly.geometry.coordinates[0];
  assert.ok(ring.length === 17);
  assert.equal(ring[0][0], ring[16][0]);
  assert.equal(ring[0][1], ring[16][1]);
});
