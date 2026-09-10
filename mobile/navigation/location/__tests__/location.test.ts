import test from 'node:test';
import assert from 'node:assert/strict';

import {
  isValidCoordinate,
  isSampleFresh,
  isAccuracyAcceptable,
  isDuplicateSample,
  isImpossibleJump,
  filterLocationSample,
  haversineDistanceMeters,
} from '../filters';

import {
  SpeedEstimator,
} from '../speed';

import {
  HeadingEstimator,
  calculateForwardBearing,
  degreesToCardinal,
} from '../heading';

import {
  evaluateGpsHealth,
  getAccuracyCategory,
} from '../health';

import {
  getPermissionErrorMessage,
} from '../permissions';

import { DEFAULT_LOCATION_CONFIG } from '../config';
import type { LocationSample } from '../types';

function createSample(overrides: Partial<LocationSample> = {}): LocationSample {
  return {
    latitude: 12.9716,
    longitude: 77.5946,
    timestamp: 1_700_000_000_000,
    accuracy: 8.5,
    altitude: 920.0,
    heading: 90.0,
    speed: 1.2,
    source: 'gps',
    ...overrides,
  };
}

// ─── 1. GPS Filtering Tests ───────────────────────────────────────────────────

test('Filters: isValidCoordinate rejects invalid, NaN, out-of-bound, or null-island coordinates', () => {
  assert.equal(isValidCoordinate(12.9716, 77.5946), true);
  assert.equal(isValidCoordinate(-33.8688, 151.2093), true);

  // NaN and Infinity
  assert.equal(isValidCoordinate(NaN, 77.5946), false);
  assert.equal(isValidCoordinate(12.9716, NaN), false);
  assert.equal(isValidCoordinate(Infinity, 77.5946), false);

  // Out of bounds
  assert.equal(isValidCoordinate(91.0, 77.5946), false);
  assert.equal(isValidCoordinate(-90.5, 77.5946), false);
  assert.equal(isValidCoordinate(12.9716, 181.0), false);
  assert.equal(isValidCoordinate(12.9716, -181.0), false);

  // Null Island (0,0)
  assert.equal(isValidCoordinate(0.0, 0.0), false);
});

test('Filters: isSampleFresh rejects stale timestamps and future timestamps', () => {
  const now = 1_700_000_010_000;
  const maxAge = 12_000;

  // Recent sample (2s old) -> acceptable
  assert.equal(isSampleFresh(now - 2000, now, maxAge), true);

  // Stale sample (15s old) -> rejected
  assert.equal(isSampleFresh(now - 15_000, now, maxAge), false);

  // Sample from far future (> 3s drift) -> rejected
  assert.equal(isSampleFresh(now + 5000, now, maxAge), false);
});

test('Filters: isAccuracyAcceptable enforces positive uncertainty threshold', () => {
  assert.equal(isAccuracyAcceptable(5.0, 65.0), true);
  assert.equal(isAccuracyAcceptable(65.0, 65.0), true);
  assert.equal(isAccuracyAcceptable(65.1, 65.0), false);
  assert.equal(isAccuracyAcceptable(0, 65.0), false);
  assert.equal(isAccuracyAcceptable(-5.0, 65.0), false);
  assert.equal(isAccuracyAcceptable(NaN, 65.0), false);
});

test('Filters: isDuplicateSample detects identical timestamps or sub-meter jitter within 500ms', () => {
  const p1 = createSample({ timestamp: 1000, latitude: 12.97160, longitude: 77.59460 });
  const identical = createSample({ timestamp: 1000, latitude: 12.97160, longitude: 77.59460 });
  const jitter = createSample({ timestamp: 1200, latitude: 12.971601, longitude: 77.594601 });
  const legitMove = createSample({ timestamp: 2000, latitude: 12.97165, longitude: 77.59465 });

  assert.equal(isDuplicateSample(p1, identical), true);
  assert.equal(isDuplicateSample(p1, jitter), true);
  assert.equal(isDuplicateSample(p1, legitMove), false);
});

test('Filters: isImpossibleJump rejects teleportation', () => {
  const p1 = createSample({ timestamp: 1000, latitude: 12.9716, longitude: 77.5946 });
  // Normal walking movement: ~2.5m in 2 seconds = 1.25 m/s
  const pWalk = createSample({ timestamp: 3000, latitude: 12.97162, longitude: 77.5946 });
  // Impossible jump: ~500 meters in 1 second = 500 m/s
  const pJump = createSample({ timestamp: 2000, latitude: 12.9760, longitude: 77.5946 });

  assert.equal(isImpossibleJump(p1, pWalk, 12.0), false);
  assert.equal(isImpossibleJump(p1, pJump, 12.0), true);
});

test('Filters: filterLocationSample comprehensive validation', () => {
  const now = 1_700_000_010_000;
  const validPrev = createSample({ timestamp: now - 2000 });
  const validNext = createSample({
    timestamp: now - 1000,
    latitude: 12.97161,
    longitude: 77.59461,
    accuracy: 6.0,
  });

  const res = filterLocationSample(validPrev, validNext, DEFAULT_LOCATION_CONFIG, now);
  assert.equal(res.accepted, true);

  // Inaccurate sample rejection
  const badAcc = createSample({ accuracy: 95.0, timestamp: now - 1000 });
  assert.equal(filterLocationSample(validPrev, badAcc, DEFAULT_LOCATION_CONFIG, now).accepted, false);
});

// ─── 2. Speed Estimation Tests ───────────────────────────────────────────────

test('SpeedEstimator: passes through valid hardware GPS speed', () => {
  const estimator = new SpeedEstimator();
  const sample = createSample({ speed: 1.45 });

  const result = estimator.estimateSpeed(sample);
  assert.equal(result.currentSpeedMps, 1.45);
  assert.equal(result.isEstimated, false);
  assert.equal(result.walkingSpeedKmph, 5.2);
});

test('SpeedEstimator: derives speed from distance/time when hardware speed is null', () => {
  const estimator = new SpeedEstimator();
  const s1 = createSample({ timestamp: 1000, latitude: 12.971600, longitude: 77.594600, speed: null });
  // ~2.22 meters displacement in 2 seconds = ~1.11 m/s (~4.0 km/h)
  const s2 = createSample({ timestamp: 3000, latitude: 12.971620, longitude: 77.594600, speed: null });

  estimator.estimateSpeed(s1);
  const result = estimator.estimateSpeed(s2);

  assert.equal(result.isEstimated, true);
  assert.ok(result.currentSpeedMps !== null && result.currentSpeedMps >= 1.0 && result.currentSpeedMps <= 1.3);
  assert.ok(result.walkingSpeedKmph !== null && result.walkingSpeedKmph >= 3.6 && result.walkingSpeedKmph <= 4.8);
});

test('SpeedEstimator: detects stationary state when distance is negligible', () => {
  const estimator = new SpeedEstimator();
  const s1 = createSample({ timestamp: 1000, latitude: 12.971600, longitude: 77.594600, speed: null });
  const s2 = createSample({ timestamp: 3000, latitude: 12.971600, longitude: 77.594600, speed: null });

  estimator.estimateSpeed(s1);
  const result = estimator.estimateSpeed(s2);

  assert.equal(result.currentSpeedMps, 0);
  assert.equal(result.isEstimated, true);
});

// ─── 3. Heading Estimation Tests ─────────────────────────────────────────────

test('Heading: calculateForwardBearing computes cardinal azimuths correctly', () => {
  // Heading due North: latitude increases, longitude constant
  const bearingNorth = calculateForwardBearing(12.0, 77.0, 13.0, 77.0);
  assert.ok(Math.abs(bearingNorth - 0) < 1.0 || Math.abs(bearingNorth - 360) < 1.0);

  // Heading due East: latitude constant, longitude increases
  const bearingEast = calculateForwardBearing(12.0, 77.0, 12.0, 78.0);
  assert.ok(Math.abs(bearingEast - 90.0) < 1.0);

  // Heading due South: latitude decreases, longitude constant
  const bearingSouth = calculateForwardBearing(13.0, 77.0, 12.0, 77.0);
  assert.ok(Math.abs(bearingSouth - 180.0) < 1.0);

  // Heading due West: latitude constant, longitude decreases
  const bearingWest = calculateForwardBearing(12.0, 78.0, 12.0, 77.0);
  assert.ok(Math.abs(bearingWest - 270.0) < 1.0);
});

test('Heading: degreesToCardinal maps compass degrees correctly', () => {
  assert.equal(degreesToCardinal(0), 'N');
  assert.equal(degreesToCardinal(90), 'E');
  assert.equal(degreesToCardinal(180), 'S');
  assert.equal(degreesToCardinal(270), 'W');
  assert.equal(degreesToCardinal(45), 'NE');
  assert.equal(degreesToCardinal(null), '—');
});

test('HeadingEstimator: enforces priority hierarchy (compass -> GPS -> movement vector -> unknown)', () => {
  const estimator = new HeadingEstimator();
  const now = 100_000;

  // 1. Compass priority when fresh
  estimator.updateCompassHeading({ degrees: 45.0, source: 'compass' }, now);
  const s1 = createSample({ timestamp: now, heading: 180.0, speed: 1.5 });
  const hCompass = estimator.resolveHeading(s1, now);
  assert.equal(hCompass.degrees, 45.0);
  assert.equal(hCompass.source, 'compass');

  // 2. GPS priority when compass is stale (> 3.5s) and moving (> 0.5 m/s)
  const later = now + 4000;
  const s2 = createSample({ timestamp: later, heading: 210.0, speed: 1.5 });
  const hGps = estimator.resolveHeading(s2, later);
  assert.equal(hGps.degrees, 210.0);
  assert.equal(hGps.source, 'gps');

  // 3. Movement vector when compass is null, GPS heading is null, and moved >= 2m
  estimator.reset();
  const sMove1 = createSample({ timestamp: 1000, latitude: 12.9716, longitude: 77.5946, heading: null, speed: null });
  const sMove2 = createSample({ timestamp: 3000, latitude: 12.9720, longitude: 77.5946, heading: null, speed: null }); // Moved North ~44m
  estimator.resolveHeading(sMove1, 1000);
  const hVector = estimator.resolveHeading(sMove2, 3000);
  assert.equal(hVector.source, 'movement_vector');
  assert.ok(hVector.degrees !== null && (Math.abs(hVector.degrees - 0) < 2 || Math.abs(hVector.degrees - 360) < 2));
});

// ─── 4. GPS Health & Permissions Tests ────────────────────────────────────────

test('GPSHealth: evaluateGpsHealth reflects fix freshness, accuracy, and permissions', () => {
  const now = 100_000;

  // Searching when no sample has arrived
  assert.equal(evaluateGpsHealth({ permission: 'granted', lastSample: null, now }), 'searching');

  // Lost when permission is denied or restricted
  assert.equal(evaluateGpsHealth({ permission: 'denied', lastSample: null, now }), 'lost');
  assert.equal(evaluateGpsHealth({ permission: 'restricted', lastSample: null, now }), 'lost');

  // Healthy with fresh fix and high accuracy
  const healthySample = createSample({ timestamp: now - 1000, accuracy: 5.0 });
  assert.equal(evaluateGpsHealth({ permission: 'granted', lastSample: healthySample, now }), 'healthy');

  // Weak with stale fix (5s old)
  const staleSample = createSample({ timestamp: now - 5000, accuracy: 5.0 });
  assert.equal(evaluateGpsHealth({ permission: 'granted', lastSample: staleSample, now }), 'weak');

  // Weak with degraded accuracy (35m)
  const degradedSample = createSample({ timestamp: now - 1000, accuracy: 35.0 });
  assert.equal(evaluateGpsHealth({ permission: 'granted', lastSample: degradedSample, now }), 'weak');

  // Lost when no fix received for > 10s
  const lostSample = createSample({ timestamp: now - 12_000, accuracy: 5.0 });
  assert.equal(evaluateGpsHealth({ permission: 'granted', lastSample: lostSample, now }), 'lost');
});

test('GPSHealth: getAccuracyCategory categorizes horizontal uncertainty', () => {
  assert.equal(getAccuracyCategory(4.5), 'high');
  assert.equal(getAccuracyCategory(18.0), 'medium');
  assert.equal(getAccuracyCategory(45.0), 'low');
  assert.equal(getAccuracyCategory(85.0), 'unusable');
  assert.equal(getAccuracyCategory(-1), 'unusable');
});

test('Permissions: getPermissionErrorMessage provides user guidance without crashing', () => {
  assert.ok(getPermissionErrorMessage('denied', true)?.includes('denied'));
  assert.ok(getPermissionErrorMessage('restricted', true)?.includes('restricted'));
  assert.ok(getPermissionErrorMessage('granted', false)?.includes('turned off'));
  assert.equal(getPermissionErrorMessage('granted', true), null);
});
