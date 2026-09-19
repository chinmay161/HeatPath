/**
 * navigationHistory.test.ts
 *
 * Unit tests for NavigationHistoryService and NavigationLogger.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { NavigationSession } from '../models';
import { NavigationHistoryService, NavigationLogger } from '../analytics';

const mockSession = {
  id: 'session_hist_1',
  route: {
    id: 'route_1',
    title: 'Coolest Marine Route',
    destination_name: 'Gateway of India',
    distance_m: 1200,
    duration_min: 15,
    avg_shade_pct: 60,
    feels_like_c: 28,
    overall_score: 0.82,
    geometry: [
      { lat: 18.9220, lon: 72.8347 },
      { lat: 18.9300, lon: 72.8380 },
    ],
    steps: [],
    raw_route: { heat_hours_avoided: 1.2 } as any,
  },
  route_geometry: [
    { lat: 18.9220, lon: 72.8347 },
    { lat: 18.9300, lon: 72.8380 },
  ],
  steps: [],
  started_at: '2026-09-19T10:00:00.000Z',
  created_at: '2026-09-19T10:00:00.000Z',
  status: 'COMPLETED',
  progress: {
    current_step_index: 1,
    total_steps: 2,
    distance_traveled_m: 1180,
    remaining_distance_m: 20,
    fraction_completed: 0.98,
    elapsed_duration_s: 900,
    remaining_duration_s: 15,
  },
  paused: false,
  completed: true,
  current_step_index: 1,
  total_distance_m: 1200,
  remaining_distance_m: 20,
  estimated_duration_s: 900,
  remaining_duration_s: 15,
} as unknown as NavigationSession;

test('NavigationHistoryService: records and retrieves completed session record', async () => {
  const service = new NavigationHistoryService();

  const record = await service.recordSession(
    mockSession,
    'COMPLETED',
    [],
    new Date('2026-09-19T10:15:00.000Z').getTime()
  );

  assert.equal(record.sessionId, 'session_hist_1');
  assert.equal(record.finalStatus, 'COMPLETED');
  assert.equal(record.destinationName, 'Gateway of India');
  assert.equal(record.walkedDistanceM, 1180);
  assert.equal(record.durationSeconds, 900);
  assert.equal(record.avgShadePct, 60);
  assert.equal(record.rerouteCount, 0);

  const list = service.getCachedRecords();
  assert.equal(list.length, 1);
  assert.equal(list[0].sessionId, 'session_hist_1');
});

test('NavigationLogger: logs structured events and compiles metrics summary', () => {
  const logger = new NavigationLogger();

  logger.log('off_route', { distance: 30 });
  logger.log('route_recovered', { distance: 10 });
  logger.log('reroute_start', { reason: 'off route confirmed' });
  logger.log('reroute_success', { newRouteId: 'route_2' });
  logger.log('voice_played', { text: 'Turn left' });

  const summary = logger.getMetricsSummary();

  assert.equal(summary.totalEvents, 5);
  assert.equal(summary.offRouteEvents, 1);
  assert.equal(summary.recoveryEvents, 1);
  assert.equal(summary.rerouteRequests, 1);
  assert.equal(summary.rerouteSuccesses, 1);
  assert.equal(summary.rerouteFailures, 0);
  assert.equal(summary.voicePlayedCount, 1);
});
