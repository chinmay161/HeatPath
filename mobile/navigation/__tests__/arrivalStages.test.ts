/**
 * arrivalStages.test.ts
 *
 * Unit tests for multi-stage arrival detection:
 * EN_ROUTE -> APPROACHING -> ARRIVED -> COMPLETED.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { LocationSample } from '../location/types';
import type { NavigationCoordinate } from '../models';
import { evaluateArrival, ArrivalTracker } from '../engine/arrivalDetector';

const destination: NavigationCoordinate = { lat: 18.9220, lon: 72.8347 };

function makeLoc(lat: number, lon: number, accuracy: number = 5): LocationSample {
  return {
    latitude: lat,
    longitude: lon,
    accuracy,
    altitude: 10,
    heading: 0,
    speed: 1.2,
    source: 'gps',
    timestamp: Date.now(),
  };
}

test('evaluateArrival: classifies EN_ROUTE when user is > 50m away', () => {
  // ~111m away north
  const loc = makeLoc(18.9230, 72.8347);
  const evalResult = evaluateArrival(loc, destination);

  assert.equal(evalResult.stage, 'EN_ROUTE');
  assert.equal(evalResult.hasArrived, false);
  assert.equal(evalResult.isApproaching, false);
});

test('evaluateArrival: classifies APPROACHING when user is within 50m', () => {
  // ~33m away north
  const loc = makeLoc(18.9223, 72.8347);
  const evalResult = evaluateArrival(loc, destination);

  assert.equal(evalResult.stage, 'APPROACHING');
  assert.equal(evalResult.hasArrived, false);
  assert.equal(evalResult.isApproaching, true);
  assert.ok(evalResult.distanceToDestinationM <= 50);
});

test('evaluateArrival: classifies ARRIVED when user is within 15m with good fix', () => {
  // ~10m away
  const loc = makeLoc(18.92208, 72.8347, 5);
  const evalResult = evaluateArrival(loc, destination);

  assert.equal(evalResult.stage, 'ARRIVED');
  assert.equal(evalResult.hasArrived, true);
  assert.ok(evalResult.distanceToDestinationM <= 15);
});

test('ArrivalTracker: transitions progressively EN_ROUTE -> APPROACHING -> ARRIVED -> COMPLETED', () => {
  const tracker = new ArrivalTracker();

  // 1. Far away
  const r1 = tracker.update(makeLoc(18.9250, 72.8347), destination);
  assert.equal(r1.stage, 'EN_ROUTE');

  // 2. Approaching within 40m
  const r2 = tracker.update(makeLoc(18.9223, 72.8347), destination);
  assert.equal(r2.stage, 'APPROACHING');

  // 3. Reached destination within 10m
  const r3 = tracker.update(makeLoc(18.92205, 72.8347), destination);
  assert.equal(r3.stage, 'ARRIVED');
  assert.equal(r3.hasArrived, true);

  // 4. Mark completed
  tracker.markCompleted();
  assert.equal(tracker.getStage(), 'COMPLETED');
});
