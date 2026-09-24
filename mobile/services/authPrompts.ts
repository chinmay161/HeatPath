/**
 * authPrompts.ts
 *
 * Manages the non-intrusive authentication onboarding prompt experience:
 * 1. One-time Welcome prompt after onboarding.
 * 2. Contextual prompt after the user's first planned route.
 *
 * Implements strict frequency rules:
 * - Each prompt is shown at most once.
 * - Prompts are NEVER displayed in the same session.
 * - Suppressed during active walking/navigation, rerouting, or when already authenticated.
 * - Logs strictly non-identifying analytics events (zero PII, zero tokens, zero UUIDs).
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { STORAGE_KEY_AUTH0_SESSION } from './auth0';

export const STORAGE_KEY_WELCOME_SEEN = 'heatpath_auth_welcome_seen';
export const STORAGE_KEY_ROUTE_SEEN = 'heatpath_route_auth_prompt_seen';
export const STORAGE_KEY_EVER_AUTHENTICATED = 'heatpath_has_ever_authenticated';

export type AuthPromptEvent =
  | 'auth_prompt_welcome_shown'
  | 'auth_prompt_welcome_continue_guest'
  | 'auth_prompt_welcome_sign_in'
  | 'auth_prompt_route_shown'
  | 'auth_prompt_route_maybe_later'
  | 'auth_prompt_route_sign_in';

export interface AuthPromptLogEntry {
  readonly id: string;
  readonly event: AuthPromptEvent;
  readonly timestamp: number;
}

// In-memory runtime session tracking
// Guarantees Welcome Prompt and Route Prompt are never both displayed in the same app session
let sessionPromptShown = false;

// Structured in-memory non-identifying telemetry log
const promptAnalyticsLogs: AuthPromptLogEntry[] = [];
let logCounter = 0;

/**
 * Records a non-identifying analytics event.
 * Strictly avoids logging personal information, Auth0 tokens, guest UUIDs, or location coordinates.
 */
export function logAuthPromptEvent(event: AuthPromptEvent): AuthPromptLogEntry {
  logCounter += 1;
  const entry: AuthPromptLogEntry = {
    id: `auth_prompt_${Date.now()}_${logCounter}`,
    event,
    timestamp: Date.now(),
  };

  promptAnalyticsLogs.push(entry);
  if (promptAnalyticsLogs.length > 100) {
    promptAnalyticsLogs.shift();
  }

  return entry;
}

/**
 * Returns recent non-identifying analytics log entries.
 */
export function getAuthPromptLogs(): readonly AuthPromptLogEntry[] {
  return [...promptAnalyticsLogs];
}

/**
 * Clears telemetry logs (for testing).
 */
export function clearAuthPromptLogs(): void {
  promptAnalyticsLogs.length = 0;
  logCounter = 0;
}

/**
 * Checks whether any auth prompt was already presented in the current app session.
 */
export function hasShownPromptInCurrentSession(): boolean {
  return sessionPromptShown;
}

/**
 * Sets the session prompt flag to true once any prompt is presented.
 */
export function setPromptShownInCurrentSession(shown: boolean = true): void {
  sessionPromptShown = shown;
}

/**
 * Resets the session prompt flag (useful when simulating app restarts in tests).
 */
export function resetSessionPromptFlag(): void {
  sessionPromptShown = false;
}

/**
 * Records that a user has authenticated, ensuring prompts are permanently suppressed.
 */
export async function recordAuthenticationSuccess(): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY_EVER_AUTHENTICATED, 'true');
  } catch (err) {
    console.warn('[authPrompts] Error persisting authentication status:', err);
  }
}

/**
 * Checks if the user is currently authenticated or has ever authenticated previously.
 */
export async function hasEverAuthenticated(): Promise<boolean> {
  try {
    const [flag, session] = await Promise.all([
      AsyncStorage.getItem(STORAGE_KEY_EVER_AUTHENTICATED),
      AsyncStorage.getItem(STORAGE_KEY_AUTH0_SESSION),
    ]);
    return flag === 'true' || session !== null;
  } catch {
    return false;
  }
}

export interface CanShowPromptOptions {
  readonly isAuthenticated?: boolean;
  readonly isNavigationActive?: boolean;
  readonly isRerouting?: boolean;
  readonly debugForce?: boolean;
}

/**
 * Determines whether the Welcome prompt may be displayed after onboarding.
 * Conditions:
 * 1. User is NOT authenticated
 * 2. User has never authenticated
 * 3. Welcome prompt has not been seen before
 * 4. No prompt was shown in the current session
 */
export async function canShowWelcomePrompt(options?: {
  isAuthenticated?: boolean;
  debugForce?: boolean;
}): Promise<boolean> {
  if (options?.debugForce) {
    return true;
  }

  if (options?.isAuthenticated) {
    return false;
  }

  if (hasShownPromptInCurrentSession()) {
    return false;
  }

  const everAuth = await hasEverAuthenticated();
  if (everAuth) {
    return false;
  }

  try {
    const seen = await AsyncStorage.getItem(STORAGE_KEY_WELCOME_SEEN);
    return seen !== 'true';
  } catch {
    return false;
  }
}

/**
 * Marks the Welcome prompt as seen and updates the session flag.
 */
export async function markWelcomePromptSeen(): Promise<void> {
  setPromptShownInCurrentSession(true);
  try {
    await AsyncStorage.setItem(STORAGE_KEY_WELCOME_SEEN, 'true');
  } catch (err) {
    console.warn('[authPrompts] Error marking welcome prompt seen:', err);
  }
}

/**
 * Determines whether the Contextual Route prompt may be displayed after a planned route.
 * Conditions:
 * 1. User is still a guest (not authenticated)
 * 2. User has never authenticated
 * 3. User has successfully planned their first route
 * 4. Route prompt has not been dismissed previously
 * 5. No prompt was shown in the current session (never both in the same session)
 * 6. Navigation is calm (not actively walking, rerouting, or recalculating)
 */
export async function canShowRoutePrompt(options: CanShowPromptOptions): Promise<boolean> {
  if (options.debugForce) {
    return true;
  }

  if (options.isAuthenticated) {
    return false;
  }

  // Calm moment rule: Never show during active walking, navigation, or rerouting
  if (options.isNavigationActive || options.isRerouting) {
    return false;
  }

  // Session frequency rule: Never show both prompts in the same session
  if (hasShownPromptInCurrentSession()) {
    return false;
  }

  const everAuth = await hasEverAuthenticated();
  if (everAuth) {
    return false;
  }

  try {
    const seen = await AsyncStorage.getItem(STORAGE_KEY_ROUTE_SEEN);
    return seen !== 'true';
  } catch {
    return false;
  }
}

/**
 * Marks the Route prompt as seen/dismissed and updates the session flag.
 */
export async function markRoutePromptSeen(): Promise<void> {
  setPromptShownInCurrentSession(true);
  try {
    await AsyncStorage.setItem(STORAGE_KEY_ROUTE_SEEN, 'true');
  } catch (err) {
    console.warn('[authPrompts] Error marking route prompt seen:', err);
  }
}

/**
 * Resets prompt states. Used when onboarding is reset or for developer testing.
 */
export async function resetAuthPrompts(): Promise<void> {
  resetSessionPromptFlag();
  try {
    await AsyncStorage.multiRemove([
      STORAGE_KEY_WELCOME_SEEN,
      STORAGE_KEY_ROUTE_SEEN,
      STORAGE_KEY_EVER_AUTHENTICATED,
    ]);
  } catch (err) {
    console.warn('[authPrompts] Error resetting auth prompts:', err);
  }
}
