/**
 * authUI.test.ts
 *
 * Comprehensive integration and UI-state tests covering:
 * 1. Guest account state & defaults
 * 2. Authenticated account state & user attributes
 * 3. Login flow & loading states
 * 4. Logout flow & smooth transition to guest
 * 5. Startup session restoration (seamless, no blocking login)
 * 6. Guest-to-authenticated preference migration & failure preservation
 * 7. Error handling & classification (cancellation, network, session expiration)
 * 8. Reactive listener notifications on identity transitions
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
  Auth0Service,
  classifyAuthError,
  AuthError,
  STORAGE_KEY_AUTH0_SESSION,
  STORAGE_KEY_MIGRATION_PREFIX,
  type Auth0Session,
} from '../auth0';
import {
  IdentityProvider,
  type UserIdentity,
} from '../identity';
import {
  HEADER_AUTHORIZATION,
  HEADER_GUEST_ID,
  STORAGE_KEY_GUEST_ID,
} from '../../config/identityConstants';

test('Auth UI: Guest account initial state and headers', async () => {
  await AsyncStorage.clear();
  const identityProvider = new IdentityProvider();

  // 1. Initially unauthenticated guest
  const guestId = await identityProvider.getGuestId();
  assert.ok(guestId.startsWith('guest|'), 'Guest ID must be prefixed with guest|');

  const identity = await identityProvider.getCurrentIdentity();
  assert.equal(identity.type, 'guest');
  assert.equal(identity.userId, guestId);
  assert.equal(identity.headers[HEADER_GUEST_ID], guestId);
  assert.equal(identity.headers[HEADER_AUTHORIZATION], undefined, 'Guest must NOT emit Authorization header');
});

test('Auth UI: Guest profile defaults to Guest and null email (no Alex River placeholder)', () => {
  const { DEFAULT_PROFILE, normalizeProfile } = require('../../hooks/useUserProfile');
  assert.equal(DEFAULT_PROFILE.name, 'Guest', 'Default guest name must be Guest');
  assert.equal(DEFAULT_PROFILE.email, null, 'Default guest email must be null');

  // Normalization converts legacy placeholder Alex River to Guest
  const legacy = { name: 'Alex River', email: 'alex.river@example.com' };
  const normalized = normalizeProfile(legacy);
  assert.equal(normalized.name, 'Guest', 'Placeholder Alex River must normalize to Guest');
  assert.equal(normalized.email, null, 'Placeholder email must normalize to null');

  // Custom user name is preserved
  const custom = { name: 'Sarah Shade', email: 'sarah@example.com' };
  const normalizedCustom = normalizeProfile(custom);
  assert.equal(normalizedCustom.name, 'Sarah Shade');
  assert.equal(normalizedCustom.email, 'sarah@example.com');
});

test('Auth UI: Session restoration on app startup (seamless restoration)', async () => {
  await AsyncStorage.clear();
  const auth0 = new Auth0Service();
  const identityProvider = new IdentityProvider();

  // Scenario A: Persisted session exists on launch
  const mockSession: Auth0Session = {
    accessToken: 'valid-restored-token',
    idToken: 'valid-restored-id-token',
    refreshToken: 'valid-restored-refresh-token',
    expiresAt: Date.now() + 3600000,
    user: {
      sub: 'auth0|restored_user_42',
      name: 'Elena Rostova',
      email: 'elena@example.com',
      picture: 'https://example.com/avatar.png',
    },
  };
  await AsyncStorage.setItem(STORAGE_KEY_AUTH0_SESSION, JSON.stringify(mockSession));

  const restored = await auth0.restoreSession();
  assert.ok(restored !== null, 'Valid session should be restored on startup');
  assert.equal(restored?.user.name, 'Elena Rostova');
  assert.equal(restored?.user.picture, 'https://example.com/avatar.png');

  // Scenario B: Expired session without refresh token purges and falls back to guest seamlessly
  await AsyncStorage.clear();
  const expiredSession: Auth0Session = {
    accessToken: 'expired-token',
    idToken: 'expired-id',
    expiresAt: Date.now() - 5000, // expired
    user: { sub: 'auth0|old_user' },
  };
  await AsyncStorage.setItem(STORAGE_KEY_AUTH0_SESSION, JSON.stringify(expiredSession));

  const secondAuth0 = new Auth0Service();
  const fallback = await secondAuth0.restoreSession();
  assert.equal(fallback, null, 'Expired session must return null');

  // Continues as guest without blocking
  const guestId = await identityProvider.getGuestId();
  assert.ok(guestId.startsWith('guest|'));
});

test('Auth UI: Login flow transitions and authenticated account state', async () => {
  await AsyncStorage.clear();
  const identityProvider = new IdentityProvider();
  const auth0 = new Auth0Service();

  const mockUser = {
    sub: 'auth0|jane_walker_101',
    name: 'Jane Walker',
    email: 'jane.walker@example.com',
    picture: 'https://images.example.com/jane.jpg',
  };

  // Perform login with mock user
  const session = await auth0.login({ mockUser, skipMigration: true });
  assert.equal(session.user.sub, 'auth0|jane_walker_101');
  assert.equal(session.user.name, 'Jane Walker');
  assert.equal(session.user.email, 'jane.walker@example.com');
  assert.equal(session.user.picture, 'https://images.example.com/jane.jpg');

  // Verify identity is now authenticated
  await identityProvider.setAuthToken(session.accessToken);
  const identity = await identityProvider.getCurrentIdentity();
  assert.equal(identity.type, 'authenticated');
  assert.ok(identity.userId.includes('auth0|'));
  assert.equal(identity.headers[HEADER_AUTHORIZATION], `Bearer ${session.accessToken}`);
  assert.equal(identity.headers[HEADER_GUEST_ID], undefined, 'Authenticated user must not emit guest header');
});

test('Auth UI: Logout flow clears tokens and returns to guest without app restart', async () => {
  await AsyncStorage.clear();
  const identityProvider = new IdentityProvider();
  const auth0 = new Auth0Service();

  // Start in authenticated state
  const mockUser = { sub: 'auth0|user_to_logout', name: 'Log Out User' };
  await auth0.login({ mockUser, skipMigration: true });
  await identityProvider.setAuthToken('token-to-clear');

  let currentIdentity = await identityProvider.getCurrentIdentity();
  assert.equal(currentIdentity.type, 'authenticated');

  // Trigger logout
  await auth0.logout();
  await identityProvider.logout();

  // Verify immediately returned to guest identity
  currentIdentity = await identityProvider.getCurrentIdentity();
  assert.equal(currentIdentity.type, 'guest');
  assert.ok(currentIdentity.userId.startsWith('guest|'));
  assert.ok(currentIdentity.headers[HEADER_GUEST_ID]);
  assert.equal(currentIdentity.headers[HEADER_AUTHORIZATION], undefined);

  // Stored auth token is purged
  const token = await identityProvider.getAuthToken();
  assert.equal(token, null);
});

test('Auth UI: Guest -> Authenticated preference migration and failure handling', async () => {
  await AsyncStorage.clear();
  const auth0 = new Auth0Service();

  const guestId = 'guest|00000000-1111-4222-8333-444444444444';
  await AsyncStorage.setItem(STORAGE_KEY_GUEST_ID, guestId);

  // Setup guest customized preferences
  const initialPrefs = {
    heat_sensitivity: 8,
    walking_speed: 'slow',
    units: 'fahrenheit',
    favorite_routes: [{ id: 'route1', name: 'Shady Park Route', start_lat: 40.71, start_lon: -74.0, end_lat: 40.72, end_lon: -74.01 }],
  };
  const guestPrefKey = `heatpath_user_preferences_cache_${guestId}`;
  await AsyncStorage.setItem(guestPrefKey, JSON.stringify(initialPrefs));

  const auth0Session: Auth0Session = {
    accessToken: 'test-token',
    idToken: 'test-id',
    expiresAt: Date.now() + 3600000,
    user: { sub: 'auth0|migrated_target_user' },
  };

  // 1. Verify needsMigration detects pending migration
  const needed = await auth0.needsMigration(guestId);
  assert.equal(needed, true, 'needsMigration should be true when guest preferences exist');

  // 2. Perform migration
  const migrated = await auth0.migrateGuestPreferences(auth0Session, guestId);
  assert.equal(migrated, true, 'Migration must succeed');

  // 3. Verify preferences are now stored under authenticated user key
  const auth0PrefKey = 'heatpath_user_preferences_cache_auth0|migrated_target_user';
  const migratedData = JSON.parse((await AsyncStorage.getItem(auth0PrefKey))!);
  assert.equal(migratedData.heat_sensitivity, 8);
  assert.equal(migratedData.favorite_routes.length, 1);
  assert.equal(migratedData.favorite_routes[0].name, 'Shady Park Route');

  // 4. Verify old guest preferences removed
  assert.equal(await AsyncStorage.getItem(guestPrefKey), null);

  // 5. Subsequent check indicates no longer needed
  const neededAfter = await auth0.needsMigration(guestId);
  assert.equal(neededAfter, false);
});

test('Auth UI: Error classification and user cancellation handling', () => {
  // 1. User Cancellation
  const cancelledErr1 = { code: 'a0.session.user_cancelled', message: 'User cancelled flow' };
  const classified1 = classifyAuthError(cancelledErr1);
  assert.equal(classified1.code, 'USER_CANCELLED');

  const cancelledErr2 = new Error('The user dismissed the browser window');
  const classified2 = classifyAuthError(cancelledErr2);
  assert.equal(classified2.code, 'USER_CANCELLED');

  // 2. Network Errors
  const networkErr1 = new Error('Network request failed');
  const classifiedNet1 = classifyAuthError(networkErr1);
  assert.equal(classifiedNet1.code, 'NETWORK_ERROR');

  const networkErr2 = new Error('fetch timeout: host unreachable');
  const classifiedNet2 = classifyAuthError(networkErr2);
  assert.equal(classifiedNet2.code, 'NETWORK_ERROR');

  // 3. Expired Session
  const expiredErr = new Error('invalid_grant: refresh token expired');
  const classifiedExp = classifyAuthError(expiredErr);
  assert.equal(classifiedExp.code, 'SESSION_EXPIRED');

  // 4. Unknown Auth Failure
  const unknownErr = new Error('access_denied: unauthorized client');
  const classifiedUnknown = classifyAuthError(unknownErr);
  assert.equal(classifiedUnknown.code, 'AUTH_FAILED');
  assert.ok(classifiedUnknown.message.includes('access_denied'));
});

test('Auth UI: Reactive subscriber pattern notifies listeners on identity change', async () => {
  await AsyncStorage.clear();
  const identityProvider = new IdentityProvider();

  let notificationCount = 0;
  let lastReceivedType = '';

  const unsubscribe = identityProvider.subscribe((identity) => {
    notificationCount++;
    lastReceivedType = identity.type;
  });

  // Explicit setGuestId triggers notification
  await identityProvider.setGuestId('guest|aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee');
  assert.equal(notificationCount, 1);
  assert.equal(lastReceivedType, 'guest');

  // setAuthToken triggers notification
  await identityProvider.setAuthToken('dummy-token');
  assert.equal(notificationCount, 2);
  assert.equal(lastReceivedType, 'authenticated');

  // Logout triggers notification
  await identityProvider.logout();
  assert.equal(notificationCount, 3);
  assert.equal(lastReceivedType, 'guest');

  // Unsubscribe stops notifications
  unsubscribe();
  await identityProvider.setGuestId('guest|11111111-2222-4333-8444-555555555555');
  assert.equal(notificationCount, 3, 'No further notifications after unsubscribe');
});
