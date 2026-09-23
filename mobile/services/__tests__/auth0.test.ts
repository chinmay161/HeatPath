/**
 * auth0.test.ts
 *
 * Unit tests for Auth0 integration:
 * - Session restoration on launch
 * - Token management and silent refresh
 * - IdentityProvider integration (authenticated vs guest)
 * - Guest preferences migration on sign-in
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
import { Auth0Service, type Auth0Session, STORAGE_KEY_AUTH0_SESSION, STORAGE_KEY_MIGRATION_PREFIX } from '../auth0';
import { IdentityProvider } from '../identity';
import { HEADER_AUTHORIZATION, HEADER_GUEST_ID, STORAGE_KEY_GUEST_ID } from '../../config/identityConstants';

test('Auth0: Session restoration restores valid persisted session', async () => {
  await AsyncStorage.clear();
  const service = new Auth0Service();

  const mockSession: Auth0Session = {
    accessToken: 'mock-access-token-123',
    idToken: 'mock-id-token-123',
    refreshToken: 'mock-refresh-token-123',
    expiresAt: Date.now() + 3600000, // 1 hour in future
    user: {
      sub: 'auth0|user_98765',
      name: 'Alex Walker',
      email: 'alex@example.com',
    },
  };

  await AsyncStorage.setItem(STORAGE_KEY_AUTH0_SESSION, JSON.stringify(mockSession));

  const restored = await service.restoreSession();
  assert.ok(restored !== null);
  assert.equal(restored?.accessToken, 'mock-access-token-123');
  assert.equal(restored?.user.sub, 'auth0|user_98765');
});

test('Auth0: Expired session without refresh token is purged', async () => {
  await AsyncStorage.clear();
  const service = new Auth0Service();

  const expiredSession: Auth0Session = {
    accessToken: 'expired-token',
    idToken: 'expired-id',
    expiresAt: Date.now() - 10000, // 10 seconds in past
    user: { sub: 'auth0|expired_user' },
  };

  await AsyncStorage.setItem(STORAGE_KEY_AUTH0_SESSION, JSON.stringify(expiredSession));

  const restored = await service.restoreSession();
  assert.equal(restored, null);
  const inStore = await AsyncStorage.getItem(STORAGE_KEY_AUTH0_SESSION);
  assert.equal(inStore, null, 'Expired session must be purged');
});

test('Auth0: IdentityProvider emits Authorization header when authenticated and omits X-Guest-ID', async () => {
  await AsyncStorage.clear();
  const identityProvider = new IdentityProvider();
  const auth0Service = (await import('../auth0')).auth0Service;

  const session: Auth0Session = {
    accessToken: 'valid-jwt-token-xyz',
    idToken: 'id-token-xyz',
    expiresAt: Date.now() + 3600000,
    user: { sub: 'auth0|654321' },
  };

  await auth0Service.setSession(session);

  const identity = await identityProvider.getCurrentIdentity();
  assert.equal(identity.type, 'authenticated');
  assert.equal(identity.userId, 'auth0|654321');
  assert.equal(identity.headers[HEADER_AUTHORIZATION], 'Bearer valid-jwt-token-xyz');
  assert.equal(identity.headers[HEADER_GUEST_ID], undefined, 'Must NEVER send X-Guest-ID when authenticated');

  // Test logout transitions back to guest identity
  await identityProvider.logout();
  const guestIdentity = await identityProvider.getCurrentIdentity();
  assert.equal(guestIdentity.type, 'guest');
  assert.ok(guestIdentity.userId.startsWith('guest|'));
  assert.ok(guestIdentity.headers[HEADER_GUEST_ID]);
  assert.equal(guestIdentity.headers[HEADER_AUTHORIZATION], undefined, 'Must NEVER send Authorization when guest');
});

test('Auth0: One-time migration copies guest preferences to Auth0 account on first sign-in', async () => {
  await AsyncStorage.clear();
  const service = new Auth0Service();

  const guestId = 'guest|11111111-2222-4333-8444-555555555555';
  await AsyncStorage.setItem(STORAGE_KEY_GUEST_ID, guestId);

  // Setup sample guest preferences
  const guestPrefs = {
    heat_sensitivity: 9,
    units: 'fahrenheit',
    walking_speed: 'brisk',
  };
  const guestPrefKey = `heatpath_user_preferences_cache_${guestId}`;
  await AsyncStorage.setItem(guestPrefKey, JSON.stringify(guestPrefs));

  const auth0Session: Auth0Session = {
    accessToken: 'test-token',
    idToken: 'test-id',
    expiresAt: Date.now() + 3600000,
    user: { sub: 'auth0|target_user_id' },
  };

  // Perform migration
  const migrated = await service.migrateGuestPreferencesIfPresent(auth0Session);
  assert.equal(migrated, true, 'First migration must succeed');

  // Verify preferences copied to Auth0 account
  const auth0PrefKey = 'heatpath_user_preferences_cache_auth0|target_user_id';
  const migratedPrefsRaw = await AsyncStorage.getItem(auth0PrefKey);
  assert.ok(migratedPrefsRaw !== null);
  const migratedPrefs = JSON.parse(migratedPrefsRaw!);
  assert.equal(migratedPrefs.heat_sensitivity, 9);
  assert.equal(migratedPrefs.units, 'fahrenheit');

  // Verify old guest preferences removed
  const remainingGuestRaw = await AsyncStorage.getItem(guestPrefKey);
  assert.equal(remainingGuestRaw, null, 'Old guest preferences must be cleared');

  // Verify migration runs only once
  const secondMigration = await service.migrateGuestPreferencesIfPresent(auth0Session);
  assert.equal(secondMigration, false, 'Migration must not run a second time');
});
