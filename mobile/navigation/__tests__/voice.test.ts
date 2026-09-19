/**
 * voice.test.ts
 *
 * Unit tests for SpeechQueue, ManeuverFormatter, UpcomingManeuverTracker,
 * VoiceSettingsManager, and VoiceService.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { NavigationStep } from '../models';
import {
  SpeechQueue,
  formatManeuverSpeech,
  formatOffRouteSpeech,
  formatRouteRecoveredSpeech,
  formatArrivalSpeech,
  UpcomingManeuverTracker,
  VoiceSettingsManager,
  VoiceService,
  MemoryTTSProvider,
} from '../voice';

const mockStep: NavigationStep = {
  index: 2,
  instruction: 'Turn right',
  distance_m: 120,
  duration_s: 90,
  shade_pct: 75,
  name: 'Marine Drive',
  start_location: { lat: 18.9250, lon: 72.8347 },
  end_location: { lat: 18.9250, lon: 72.8380 },
  maneuver_type: 'right',
  bearing_deg: 90,
  icon_name: 'arrow-right',
};

test('ManeuverFormatter: formats prepare stage at 100m with street and shade context', () => {
  const instruction = formatManeuverSpeech(mockStep, 'prepare', 100);

  assert.equal(instruction.stage, 'prepare');
  assert.equal(instruction.priority, 'normal');
  assert.ok(instruction.text.includes('In 100 meters'));
  assert.ok(instruction.text.includes('turn right'));
  assert.ok(instruction.text.includes('onto Marine Drive'));
  assert.ok(instruction.text.includes('on shaded walkway'));
});

test('ManeuverFormatter: formats immediate turn stage at 30m', () => {
  const instruction = formatManeuverSpeech(mockStep, 'turn', 25);

  assert.equal(instruction.stage, 'turn');
  assert.equal(instruction.priority, 'high');
  assert.ok(!instruction.text.includes('In 25 meters'));
  assert.ok(instruction.text.startsWith('Turn right'));
});

test('ManeuverFormatter: formats off-route and arrival speech', () => {
  const offRoute = formatOffRouteSpeech();
  assert.equal(offRoute.priority, 'urgent');
  assert.ok(offRoute.text.includes('off route'));

  const recovery = formatRouteRecoveredSpeech();
  assert.equal(recovery.priority, 'high');
  assert.ok(recovery.text.includes('Route recovered'));

  const arrival = formatArrivalSpeech('Gateway of India');
  assert.equal(arrival.priority, 'urgent');
  assert.ok(arrival.text.includes('You have arrived at Gateway of India'));
});

test('UpcomingManeuverTracker: announces prepare once, then turn once, preventing duplicate speech', () => {
  const tracker = new UpcomingManeuverTracker();

  // 1. Approaching at 95m -> triggers prepare
  const instr1 = tracker.evaluateManeuver(mockStep, 95);
  assert.notEqual(instr1, null);
  assert.equal(instr1?.stage, 'prepare');

  // 2. Next GPS sample at 90m -> should NOT trigger duplicate prepare
  const instr2 = tracker.evaluateManeuver(mockStep, 90);
  assert.equal(instr2, null);

  // 3. Closely approaching turn at 28m -> triggers turn
  const instr3 = tracker.evaluateManeuver(mockStep, 28);
  assert.notEqual(instr3, null);
  assert.equal(instr3?.stage, 'turn');

  // 4. Next GPS tick at 22m -> should NOT trigger duplicate turn
  const instr4 = tracker.evaluateManeuver(mockStep, 22);
  assert.equal(instr4, null);
});

test('SpeechQueue: deduplicates identical instructions within time window', () => {
  const memoryProvider = new MemoryTTSProvider();
  const queue = new SpeechQueue(memoryProvider, { deduplicationWindowMs: 4000 });

  const item1 = {
    id: '1',
    text: 'Turn right onto Marine Drive.',
    priority: 'normal' as const,
    createdAt: 0,
  };

  const added1 = queue.enqueue(item1, 0);
  assert.equal(added1, true);

  // Immediate identical duplicate is rejected
  const addedDuplicate = queue.enqueue(item1, 1000);
  assert.equal(addedDuplicate, false);
});

test('SpeechQueue: urgent instruction clears lower-priority pending queue', () => {
  const memoryProvider = new MemoryTTSProvider();
  const queue = new SpeechQueue(memoryProvider);

  queue.enqueue({
    id: 'low1',
    text: 'Continue straight for 300 meters.',
    priority: 'low',
    createdAt: 0,
  }, 0);

  // Enqueue urgent reroute alert
  queue.enqueue({
    id: 'urgent1',
    text: 'You are off route. Recalculating route.',
    priority: 'urgent',
    createdAt: 10,
  }, 10);

  // The low priority pending item should have been discarded
  assert.ok(queue.getQueueLength() <= 1);
});

test('VoiceService: respects mute toggle without raising errors', async () => {
  const memoryProvider = new MemoryTTSProvider();
  const settingsManager = new VoiceSettingsManager({ muted: false });
  const service = new VoiceService(memoryProvider, settingsManager);

  assert.equal(service.isMuted(), false);

  const announced1 = service.announce({
    id: '1',
    text: 'Turn left.',
    priority: 'normal',
    createdAt: 0,
  });
  assert.equal(announced1, true);

  // Mute voice
  await service.toggleMute();
  assert.equal(service.isMuted(), true);

  // Muted announcements return false and are dropped
  const announcedWhileMuted = service.announce({
    id: '2',
    text: 'Turn right.',
    priority: 'normal',
    createdAt: 0,
  });
  assert.equal(announcedWhileMuted, false);
});
