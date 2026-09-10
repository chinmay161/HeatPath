import AsyncStorage from '@react-native-async-storage/async-storage';
import type {
  NavigationProgress,
  NavigationRoute,
  NavigationSession,
  NavigationState,
} from '../models';

export const NAVIGATION_STORAGE_KEY = '@heatpath/active_navigation_session';

/**
 * Shape of persisted navigation state.
 * Strictly excludes transient data: live GPS, ETA, speed, bearing.
 */
export interface PersistedNavigationSession {
  readonly sessionId: string;
  readonly route: NavigationRoute;
  readonly state: NavigationState;
  readonly startedAt: string | null;
  readonly currentStepIndex: number;
  readonly createdAt: string;
}

/**
 * Persists only active navigation sessions to AsyncStorage.
 */
export async function saveNavigationSession(session: NavigationSession): Promise<void> {
  // If session is IDLE or COMPLETED, remove active storage
  if (session.status === 'IDLE' || session.status === 'COMPLETED') {
    await clearNavigationSession();
    return;
  }

  const payload: PersistedNavigationSession = {
    sessionId: session.id,
    route: session.route,
    state: session.status,
    startedAt: session.started_at,
    currentStepIndex: session.current_step_index,
    createdAt: session.created_at,
  };

  await AsyncStorage.setItem(NAVIGATION_STORAGE_KEY, JSON.stringify(payload));
}

/**
 * Restores the active navigation session from AsyncStorage.
 *
 * Rules:
 * If the application restarts during navigation (NAVIGATING or PAUSED):
 * - Restore session
 * - Return state to READY
 * - User can resume navigation manually (never auto-resume active navigation)
 */
export async function restoreNavigationSession(): Promise<NavigationSession | null> {
  try {
    const raw = await AsyncStorage.getItem(NAVIGATION_STORAGE_KEY);
    if (!raw) {
      return null;
    }

    const data = JSON.parse(raw) as PersistedNavigationSession;
    if (!data || !data.sessionId || !data.route) {
      await clearNavigationSession();
      return null;
    }

    // Terminal states should not be restored
    if (data.state === 'IDLE' || data.state === 'COMPLETED') {
      await clearNavigationSession();
      return null;
    }

    // When restoring an active or paused session after app restart,
    // state MUST return to READY so user can decide to resume.
    const restoredState: NavigationState =
      data.state === 'NAVIGATING' || data.state === 'PAUSED'
        ? 'READY'
        : data.state;

    const currentStepIndex = Math.min(
      Math.max(0, data.currentStepIndex),
      Math.max(0, data.route.steps.length - 1)
    );

    const distanceTraveled = data.route.steps
      .slice(0, currentStepIndex)
      .reduce((acc, step) => acc + step.distance_m, 0);

    const remainingDistance = Math.max(0, data.route.distance_m - distanceTraveled);
    const totalSteps = data.route.steps.length;
    const fractionCompleted = totalSteps > 0 ? currentStepIndex / totalSteps : 0;
    const remainingDurationSeconds = Math.max(
      0,
      Math.round(remainingDistance / 1.33)
    );

    const progress: NavigationProgress = {
      current_step_index: currentStepIndex,
      total_steps: totalSteps,
      distance_traveled_m: distanceTraveled,
      remaining_distance_m: remainingDistance,
      fraction_completed: fractionCompleted,
      elapsed_duration_s: 0,
      remaining_duration_s: remainingDurationSeconds,
    };

    return {
      id: data.sessionId,
      route: data.route,
      route_geometry: data.route.geometry,
      steps: data.route.steps,
      started_at: data.startedAt,
      created_at: data.createdAt,
      status: restoredState,
      progress,
      paused: false,
      completed: false,
      current_step_index: currentStepIndex,
      total_distance_m: data.route.distance_m,
      remaining_distance_m: remainingDistance,
      estimated_duration_s: data.route.duration_min * 60,
      remaining_duration_s: remainingDurationSeconds,
    };
  } catch (error) {
    if (__DEV__) {
      console.warn('[restoreNavigationSession] Failed to restore navigation session:', error);
    }
    await clearNavigationSession();
    return null;
  }
}

/**
 * Removes the stored navigation session from AsyncStorage.
 */
export async function clearNavigationSession(): Promise<void> {
  try {
    await AsyncStorage.removeItem(NAVIGATION_STORAGE_KEY);
  } catch (error) {
    if (__DEV__) {
      console.warn('[clearNavigationSession] Failed to clear navigation storage:', error);
    }
  }
}
