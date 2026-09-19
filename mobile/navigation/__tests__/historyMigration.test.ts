/**
 * historyMigration.test.ts
 *
 * Unit tests for unified walk history storage and legacy migration (Task 6 / HIGH-5).
 */

// Ensure window.localStorage mock exists for Node test environment
if (typeof (globalThis as any).window === 'undefined' || !(globalThis as any).window.localStorage) {
  const memStore = new Map<string, string>();
  (globalThis as any).window = {
    localStorage: {
      getItem: (k: string) => memStore.get(k) ?? null,
      setItem: (k: string, v: string) => memStore.set(k, String(v)),
      removeItem: (k: string) => memStore.delete(k),
      clear: () => memStore.clear(),
    },
  };
}

import test from 'node:test';
import assert from 'node:assert/strict';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  NavigationHistoryService,
  HISTORY_STORAGE_KEY,
  LEGACY_STORAGE_KEY,
} from '../analytics/NavigationHistory';
import type { NavigationSession } from '../models';

const createSampleSession = (id: string): NavigationSession =>
  ({
    id,
    route: {
      id: `route_${id}`,
      title: 'Cubbon Park Green Line',
      destination_name: 'Cubbon Park Metro',
      distance_m: 850,
      duration_min: 11,
      avg_shade_pct: 72,
      feels_like_c: 27,
      overall_score: 0.88,
      geometry: [
        { lat: 12.9716, lon: 77.5946 },
        { lat: 12.9750, lon: 77.5990 },
      ],
      steps: [],
      raw_route: { heat_hours_avoided: 1.45 } as any,
    },
    route_geometry: [
      { lat: 12.9716, lon: 77.5946 },
      { lat: 12.9750, lon: 77.5990 },
    ],
    steps: [],
    started_at: '2026-09-19T08:00:00.000Z',
    created_at: '2026-09-19T08:00:00.000Z',
    status: 'COMPLETED',
    progress: {
      current_step_index: 1,
      total_steps: 2,
      distance_traveled_m: 850,
      remaining_distance_m: 0,
      fraction_completed: 1.0,
      elapsed_duration_s: 660,
      remaining_duration_s: 0,
    },
    paused: false,
    completed: true,
    current_step_index: 1,
    total_distance_m: 850,
    remaining_distance_m: 0,
    estimated_duration_s: 660,
    remaining_duration_s: 0,
  } as unknown as NavigationSession);

test('history: recordSession and toWalkRecords maintain single source of truth', async () => {
  const service = new NavigationHistoryService();
  await service.clearHistory();

  const session = createSampleSession('sess_101');
  const record = await service.recordSession(session, 'COMPLETED', [], Date.now());

  assert.equal(record.sessionId, 'sess_101');
  assert.equal(record.destinationName, 'Cubbon Park Metro');
  assert.equal(record.routeTitle, 'Cubbon Park Green Line');
  assert.equal(record.walkedDistanceM, 850);
  assert.equal(record.heatHoursAvoided, 1.45);

  const walkRecords = service.toWalkRecords();
  assert.equal(walkRecords.length, 1);
  assert.equal(walkRecords[0].id, 'sess_101');
  assert.equal(walkRecords[0].destName, 'Cubbon Park Metro');
  assert.equal(walkRecords[0].routeTitle, 'Cubbon Park Green Line');
  assert.equal(walkRecords[0].distanceM, 850);
});

test('history: recordWalk prevents duplicate records for same walk ID', async () => {
  const service = new NavigationHistoryService();
  await service.clearHistory();

  await service.recordWalk({
    id: 'walk_dup_1',
    routeTitle: 'MG Road Walk',
    destName: 'Trinity Metro',
    distanceM: 500,
    feelLikeC: 28,
    shadePct: 65,
    overallScore: 0.8,
    heatHoursAvoided: 0.9,
    timestamp: 1726732800000,
  });

  // Call recordWalk again with identical id
  await service.recordWalk({
    id: 'walk_dup_1',
    routeTitle: 'MG Road Walk (Updated)',
    destName: 'Trinity Metro',
    distanceM: 500,
    feelLikeC: 28,
    shadePct: 65,
    overallScore: 0.8,
    heatHoursAvoided: 0.9,
    timestamp: 1726732800000,
  });

  const records = service.getCachedRecords();
  assert.equal(records.length, 1, 'Duplicate walk ID must not create second record');
});

test('history: migrates legacy heatpath_walk_history to unified store', async () => {
  const service = new NavigationHistoryService();
  await service.clearHistory();

  // Inject legacy storage entry
  const legacyData = [
    {
      id: 'legacy_walk_99',
      timestamp: 1726700000000,
      routeTitle: 'Legacy Promenade Walk',
      destName: 'Promenade',
      distanceM: 1200,
      feelLikeC: 26,
      shadePct: 80,
      overallScore: 0.91,
      heatHoursAvoided: 2.1,
    },
  ];
  await AsyncStorage.setItem(LEGACY_STORAGE_KEY, JSON.stringify(legacyData));

  // Run migration
  await service.migrateLegacyHistory();

  const records = service.getCachedRecords();
  assert.equal(records.length, 1);
  assert.equal(records[0].sessionId, 'legacy_walk_99');
  assert.equal(records[0].destinationName, 'Promenade');
  assert.equal(records[0].routeTitle, 'Legacy Promenade Walk');
  assert.equal(records[0].walkedDistanceM, 1200);

  // Legacy key should be removed after migration
  const remainingLegacy = await AsyncStorage.getItem(LEGACY_STORAGE_KEY);
  assert.equal(remainingLegacy, null, 'Legacy storage key must be removed after migration');
});
