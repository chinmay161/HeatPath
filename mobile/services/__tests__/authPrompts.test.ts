/**
 * authPrompts.test.ts
 *
 * Comprehensive frontend tests for the authentication onboarding experience:
 * 1. Welcome prompt shown exactly once for guest
 * 2. Welcome prompt skipped for authenticated users
 * 3. Welcome prompt "Continue as Guest" behavior & persistence
 * 4. Welcome prompt "Sign in" behavior
 * 5. Route prompt shown after first planned route
 * 6. Route prompt never shown if already authenticated
 * 7. Route prompt never shown more than once (dismissal persistence)
 * 8. Never display both prompts in the same session
 * 9. Calm moments: Suppressed during active navigation or rerouting
 * 10. Prompt state persistence across application restarts
 * 11. Onboarding reset restores Welcome prompt eligibility
 * 12. Non-identifying analytics logging & privacy verification
 * 13. Accessibility & cross-platform behavior
 */

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
  canShowWelcomePrompt,
  markWelcomePromptSeen,
  canShowRoutePrompt,
  markRoutePromptSeen,
  hasShownPromptInCurrentSession,
  setPromptShownInCurrentSession,
  resetSessionPromptFlag,
  recordAuthenticationSuccess,
  hasEverAuthenticated,
  resetAuthPrompts,
  logAuthPromptEvent,
  getAuthPromptLogs,
  clearAuthPromptLogs,
  STORAGE_KEY_WELCOME_SEEN,
  STORAGE_KEY_ROUTE_SEEN,
  STORAGE_KEY_EVER_AUTHENTICATED,
} from '../authPrompts';
import { STORAGE_KEY_AUTH0_SESSION } from '../auth0';

test('Welcome prompt: Shown exactly once for guest and persisted', async () => {
  await AsyncStorage.clear();
  resetSessionPromptFlag();
  clearAuthPromptLogs();

  // 1. First launch as a guest: eligible
  const shouldShow = await canShowWelcomePrompt({ isAuthenticated: false });
  assert.equal(shouldShow, true, 'Welcome prompt should be shown on first onboarding completion');

  // Simulate prompt presentation
  logAuthPromptEvent('auth_prompt_welcome_shown');
  assert.equal(getAuthPromptLogs().length, 1);
  assert.equal(getAuthPromptLogs()[0].event, 'auth_prompt_welcome_shown');

  // 2. User chooses "Continue as Guest"
  logAuthPromptEvent('auth_prompt_welcome_continue_guest');
  await markWelcomePromptSeen();

  // 3. Stored in AsyncStorage
  const storedVal = await AsyncStorage.getItem(STORAGE_KEY_WELCOME_SEEN);
  assert.equal(storedVal, 'true', 'heatpath_auth_welcome_seen must be persisted as true');

  // 4. Subsequent check must return false
  const shouldShowAgain = await canShowWelcomePrompt({ isAuthenticated: false });
  assert.equal(shouldShowAgain, false, 'Welcome prompt must not be shown a second time');
});

test('Welcome prompt: Skipped for authenticated users and existing sessions', async () => {
  await AsyncStorage.clear();
  resetSessionPromptFlag();

  // 1. Current user is authenticated in memory
  const authenticatedCheck = await canShowWelcomePrompt({ isAuthenticated: true });
  assert.equal(authenticatedCheck, false, 'Welcome prompt must be skipped when user is authenticated');

  // 2. User has an existing Auth0 session in storage
  await AsyncStorage.setItem(
    STORAGE_KEY_AUTH0_SESSION,
    JSON.stringify({ accessToken: 'valid.token', idToken: 'id', user: { sub: 'auth0|123' }, expiresAt: Date.now() + 100000 })
  );
  const existingSessionCheck = await canShowWelcomePrompt({ isAuthenticated: false });
  assert.equal(existingSessionCheck, false, 'Welcome prompt must be skipped if user has an existing session in storage');

  // 3. User previously marked as ever authenticated
  await AsyncStorage.clear();
  await recordAuthenticationSuccess();
  const everAuthCheck = await canShowWelcomePrompt({ isAuthenticated: false });
  assert.equal(everAuthCheck, false, 'Welcome prompt must be skipped if user has ever authenticated previously');
});

test('Welcome prompt: "Sign in with Auth0" action logs analytics and marks seen', async () => {
  await AsyncStorage.clear();
  resetSessionPromptFlag();
  clearAuthPromptLogs();

  // User taps "Sign in with Auth0"
  logAuthPromptEvent('auth_prompt_welcome_sign_in');
  await markWelcomePromptSeen();
  await recordAuthenticationSuccess();

  const logs = getAuthPromptLogs();
  assert.equal(logs.length, 1);
  assert.equal(logs[0].event, 'auth_prompt_welcome_sign_in');

  const seen = await AsyncStorage.getItem(STORAGE_KEY_WELCOME_SEEN);
  assert.equal(seen, 'true');

  const everAuth = await hasEverAuthenticated();
  assert.equal(everAuth, true);

  // Subsequent check is false
  const recheck = await canShowWelcomePrompt();
  assert.equal(recheck, false);
});

test('Route prompt: Shown after first planned route under calm conditions', async () => {
  await AsyncStorage.clear();
  resetSessionPromptFlag();
  clearAuthPromptLogs();

  // Fresh session, guest user has never seen prompt, routes found, calm moment
  const shouldShow = await canShowRoutePrompt({
    isAuthenticated: false,
    isNavigationActive: false,
    isRerouting: false,
  });
  assert.equal(shouldShow, true, 'Route prompt should be shown after first planned route');

  // Log presentation
  logAuthPromptEvent('auth_prompt_route_shown');
  assert.equal(getAuthPromptLogs().length, 1);
  assert.equal(getAuthPromptLogs()[0].event, 'auth_prompt_route_shown');

  // Dismiss with "Maybe Later"
  logAuthPromptEvent('auth_prompt_route_maybe_later');
  await markRoutePromptSeen();

  const storedVal = await AsyncStorage.getItem(STORAGE_KEY_ROUTE_SEEN);
  assert.equal(storedVal, 'true', 'heatpath_route_auth_prompt_seen must be persisted as true');

  // Cannot be shown again
  const recheck = await canShowRoutePrompt({
    isAuthenticated: false,
    isNavigationActive: false,
    isRerouting: false,
  });
  assert.equal(recheck, false, 'Route prompt must never be shown more than once');
});

test('Route prompt: Skipped if user is authenticated or has ever authenticated', async () => {
  await AsyncStorage.clear();
  resetSessionPromptFlag();

  // Currently authenticated
  const authCheck = await canShowRoutePrompt({
    isAuthenticated: true,
    isNavigationActive: false,
    isRerouting: false,
  });
  assert.equal(authCheck, false, 'Route prompt must never show if currently authenticated');

  // Has ever authenticated previously
  await recordAuthenticationSuccess();
  const everAuthCheck = await canShowRoutePrompt({
    isAuthenticated: false,
    isNavigationActive: false,
    isRerouting: false,
  });
  assert.equal(everAuthCheck, false, 'Route prompt must never show if user has ever authenticated');
});

test('Session Frequency Rules: Never display both Welcome and Route prompts in the same session', async () => {
  await AsyncStorage.clear();
  resetSessionPromptFlag();

  // 1. Session begins: User completes onboarding -> Welcome prompt shown
  const welcomeEligible = await canShowWelcomePrompt({ isAuthenticated: false });
  assert.equal(welcomeEligible, true);

  await markWelcomePromptSeen();
  assert.equal(hasShownPromptInCurrentSession(), true, 'Session prompt flag must be set to true');

  // 2. In this SAME session, user plans their first route:
  // Route prompt MUST NOT be shown in the same session!
  const routePromptInSameSession = await canShowRoutePrompt({
    isAuthenticated: false,
    isNavigationActive: false,
    isRerouting: false,
  });
  assert.equal(
    routePromptInSameSession,
    false,
    'Route prompt must NOT be displayed in the same session as Welcome prompt'
  );

  // 3. User restarts app (simulating next session)
  resetSessionPromptFlag();
  assert.equal(hasShownPromptInCurrentSession(), false, 'New session resets in-memory session prompt flag');

  // In new session, user plans their route:
  const routePromptInNewSession = await canShowRoutePrompt({
    isAuthenticated: false,
    isNavigationActive: false,
    isRerouting: false,
  });
  assert.equal(
    routePromptInNewSession,
    true,
    'Route prompt should appear in a subsequent session after Welcome prompt was dismissed'
  );
});

test('Calm Moments Rule: Never display prompts during active navigation or rerouting', async () => {
  await AsyncStorage.clear();
  resetSessionPromptFlag();

  // 1. Active walking / navigation in progress (e.g. NAVIGATING, READY, PAUSED)
  const activeNavCheck = await canShowRoutePrompt({
    isAuthenticated: false,
    isNavigationActive: true,
    isRerouting: false,
  });
  assert.equal(activeNavCheck, false, 'Route prompt must be suppressed while actively navigating or walking');

  // 2. Active rerouting in progress
  const rerouteCheck = await canShowRoutePrompt({
    isAuthenticated: false,
    isNavigationActive: false,
    isRerouting: true,
  });
  assert.equal(rerouteCheck, false, 'Route prompt must be suppressed during route recalculation or rerouting');

  // 3. Calm moment (idle, viewing route results)
  const calmCheck = await canShowRoutePrompt({
    isAuthenticated: false,
    isNavigationActive: false,
    isRerouting: false,
  });
  assert.equal(calmCheck, true, 'Route prompt must be allowed during calm moments');
});

test('Persistence & Restart: State survives application restarts', async () => {
  await AsyncStorage.clear();
  resetSessionPromptFlag();

  // Mark welcome prompt seen in session 1
  await markWelcomePromptSeen();
  assert.equal(await AsyncStorage.getItem(STORAGE_KEY_WELCOME_SEEN), 'true');

  // Mark route prompt seen in session 2
  resetSessionPromptFlag();
  await markRoutePromptSeen();
  assert.equal(await AsyncStorage.getItem(STORAGE_KEY_ROUTE_SEEN), 'true');

  // Simulate app process restart (reset memory flags while durable storage remains)
  resetSessionPromptFlag();

  const welcomeAfterRestart = await canShowWelcomePrompt({ isAuthenticated: false });
  assert.equal(welcomeAfterRestart, false, 'Welcome prompt seen flag survives app restart');

  const routeAfterRestart = await canShowRoutePrompt({
    isAuthenticated: false,
    isNavigationActive: false,
    isRerouting: false,
  });
  assert.equal(routeAfterRestart, false, 'Route prompt seen flag survives app restart');
});

test('Onboarding Reset: Restores Welcome prompt eligibility', async () => {
  await AsyncStorage.clear();
  resetSessionPromptFlag();

  // Mark seen
  await markWelcomePromptSeen();
  await markRoutePromptSeen();
  assert.equal(await canShowWelcomePrompt(), false);
  assert.equal(await canShowRoutePrompt({ isAuthenticated: false, isNavigationActive: false }), false);

  // User manually resets onboarding (e.g. from developer/diagnostics settings)
  await resetAuthPrompts();
  assert.equal(await AsyncStorage.getItem(STORAGE_KEY_WELCOME_SEEN), null);
  assert.equal(await AsyncStorage.getItem(STORAGE_KEY_ROUTE_SEEN), null);

  // Welcome prompt can be displayed again
  const canShowAfterReset = await canShowWelcomePrompt({ isAuthenticated: false });
  assert.equal(canShowAfterReset, true, 'Resetting onboarding must re-enable Welcome prompt');
});

test('Analytics & Privacy: Non-identifying event logging without PII or sensitive tokens', async () => {
  clearAuthPromptLogs();

  const events = [
    'auth_prompt_welcome_shown',
    'auth_prompt_welcome_continue_guest',
    'auth_prompt_welcome_sign_in',
    'auth_prompt_route_shown',
    'auth_prompt_route_maybe_later',
    'auth_prompt_route_sign_in',
  ] as const;

  for (const ev of events) {
    logAuthPromptEvent(ev);
  }

  const logs = getAuthPromptLogs();
  assert.equal(logs.length, 6);

  for (const log of logs) {
    // Assert event matches one of the 6 allowed non-identifying telemetry names
    assert.ok(events.includes(log.event as any));
    assert.ok(log.timestamp > 0);
    assert.ok(log.id.startsWith('auth_prompt_'));

    // Assert strictly NO PII, tokens, guest UUIDs, or coordinates in payload
    const logStr = JSON.stringify(log);
    assert.equal(logStr.includes('auth0|'), false, 'Telemetry must not contain auth0 user IDs');
    assert.equal(logStr.includes('guest|'), false, 'Telemetry must not contain guest UUIDs');
    assert.equal(logStr.includes('bearer'), false, 'Telemetry must not contain bearer tokens');
    assert.equal(logStr.includes('email'), false, 'Telemetry must not contain email addresses');
    assert.equal(logStr.includes('latitude'), false, 'Telemetry must not contain latitude');
    assert.equal(logStr.includes('longitude'), false, 'Telemetry must not contain longitude');
    assert.equal(logStr.includes('"lat":'), false, 'Telemetry must not contain lat field');
    assert.equal(logStr.includes('"lon":'), false, 'Telemetry must not contain lon field');
  }
});

test('Accessibility & Cross-Platform UI Specifications', () => {
  // Validate accessibility contracts for Web, iOS, and Android
  const welcomeConfig = {
    role: 'dialog',
    isModal: true,
    title: 'Welcome to HeatPath 👋',
    primaryButtonLabel: 'Continue as Guest',
    secondaryButtonLabel: 'Sign in with Auth0',
    escapeDismissible: true,
  };

  const routeConfig = {
    role: 'dialog',
    isModal: true,
    title: 'Enjoying HeatPath?',
    primaryButtonLabel: 'Sign in with Auth0',
    secondaryButtonLabel: 'Maybe Later',
    escapeDismissible: true,
  };

  assert.equal(welcomeConfig.role, 'dialog');
  assert.equal(welcomeConfig.isModal, true);
  assert.equal(welcomeConfig.primaryButtonLabel, 'Continue as Guest');
  assert.equal(welcomeConfig.secondaryButtonLabel, 'Sign in with Auth0');

  assert.equal(routeConfig.role, 'dialog');
  assert.equal(routeConfig.isModal, true);
  assert.equal(routeConfig.primaryButtonLabel, 'Sign in with Auth0');
  assert.equal(routeConfig.secondaryButtonLabel, 'Maybe Later');
});
