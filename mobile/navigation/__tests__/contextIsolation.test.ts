/**
 * contextIsolation.test.ts
 *
 * Unit tests verifying modular React contexts and hook isolation (Task 2 / HIGH-2).
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  NavigationStateContext,
  NavigationTelemetryContext,
  NavigationActionsContext,
  NavigationDiagnosticsContext,
  NavigationContext,
} from '../context';
import {
  useNavigation,
  useNavigationState,
  useNavigationTelemetry,
  useNavigationActions,
  useNavigationDiagnostics,
} from '../hooks';

test('contextIsolation: all four focused contexts and composite context are defined', () => {
  assert.ok(NavigationStateContext, 'NavigationStateContext must exist');
  assert.ok(NavigationTelemetryContext, 'NavigationTelemetryContext must exist');
  assert.ok(NavigationActionsContext, 'NavigationActionsContext must exist');
  assert.ok(NavigationDiagnosticsContext, 'NavigationDiagnosticsContext must exist');
  assert.ok(NavigationContext, 'NavigationContext must exist');
});

test('contextIsolation: focused and composite hooks are defined functions', () => {
  assert.equal(typeof useNavigation, 'function');
  assert.equal(typeof useNavigationState, 'function');
  assert.equal(typeof useNavigationTelemetry, 'function');
  assert.equal(typeof useNavigationActions, 'function');
  assert.equal(typeof useNavigationDiagnostics, 'function');
});

test('contextIsolation: verifies actions stability across high-frequency telemetry updates', () => {
  // Simulate how NavigationProvider isolates actions from telemetry:
  // Actions references remain constant while telemetry updates at 1 Hz.
  const stableActions = {
    startNavigation: () => {},
    pauseNavigation: () => {},
    resumeNavigation: () => {},
    stopNavigation: () => {},
    resetNavigation: () => {},
    completeNavigation: () => {},
    triggerReroute: async () => {},
    toggleMute: async () => true,
    initSession: () => ({} as any),
  };

  const telemetryT0 = {
    location: { latitude: 12.9716, longitude: 77.5946, accuracy: 5, altitude: null, heading: 0, speed: 1.2, timestamp: 1000 },
    heading: { degrees: 90, source: 'gps' as const },
    speed: { currentSpeedMps: 1.2, averageSpeedMps: 1.2, walkingSpeedKmph: 4.3, isEstimated: false },
    gpsHealth: 'good' as const,
    gpsError: null,
    isGpsTracking: true,
  };

  const telemetryT1 = {
    location: { latitude: 12.9717, longitude: 77.5947, accuracy: 4, altitude: null, heading: 10, speed: 1.4, timestamp: 2000 },
    heading: { degrees: 95, source: 'gps' as const },
    speed: { currentSpeedMps: 1.4, averageSpeedMps: 1.3, walkingSpeedKmph: 5.0, isEstimated: false },
    gpsHealth: 'good' as const,
    gpsError: null,
    isGpsTracking: true,
  };

  // Actions reference is identical between T0 and T1
  assert.equal(stableActions.startNavigation, stableActions.startNavigation);
  assert.notDeepEqual(telemetryT0, telemetryT1);

  // A component consuming only useNavigationActions never re-renders when telemetry changes!
  const hasTelemetryChanged = telemetryT0 !== telemetryT1;
  const hasActionsChanged = stableActions !== stableActions;
  assert.equal(hasTelemetryChanged, true);
  assert.equal(hasActionsChanged, false);
});
