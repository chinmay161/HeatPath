/**
 * identity.test.ts
 *
 * Unit tests for guest identity generation, validation, AsyncStorage persistence,
 * and IdentityProvider abstraction (Phase 1).
 */

// Ensure window.localStorage mock exists for Node test runner
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
  generateUUID,
  isValidGuestId,
  IdentityProvider,
} from '../identity';
import {
  IDENTITY_PREFIX_GUEST,
  HEADER_GUEST_ID,
  STORAGE_KEY_GUEST_ID,
  UUID_V4_REGEX,
} from '../../config/identityConstants';

test('Guest Identity: generateUUID creates valid RFC4122 v4 UUIDs', () => {
  const uuid1 = generateUUID();
  const uuid2 = generateUUID();

  assert.match(uuid1, UUID_V4_REGEX, `Generated UUID "${uuid1}" should match RFC4122 v4 regex`);
  assert.match(uuid2, UUID_V4_REGEX, `Generated UUID "${uuid2}" should match RFC4122 v4 regex`);
  assert.notEqual(uuid1, uuid2, 'Consecutive UUIDs must be distinct');
});

test('Guest Identity: isValidGuestId strictly validates prefix and UUID format', () => {
  const validUuid = generateUUID();
  assert.equal(isValidGuestId(`${IDENTITY_PREFIX_GUEST}${validUuid}`), true);

  // Invalid cases
  assert.equal(isValidGuestId('guest|hello'), false);
  assert.equal(isValidGuestId('guest|123'), false);
  assert.equal(isValidGuestId('guest|../../'), false);
  assert.equal(isValidGuestId('auth0|123456'), false);
  assert.equal(isValidGuestId(validUuid), false); // Missing prefix
  assert.equal(isValidGuestId(''), false);
});

test('Guest Identity: IdentityProvider generates and persists guest ID on first launch', async () => {
  await AsyncStorage.clear();
  const provider = new IdentityProvider();

  const guestId1 = await provider.getGuestId();
  assert.ok(guestId1.startsWith(IDENTITY_PREFIX_GUEST), 'Guest ID must start with "guest|"');
  assert.ok(isValidGuestId(guestId1), 'Guest ID must be valid RFC4122 UUID v4');

  // Verify stored in AsyncStorage
  const stored = await AsyncStorage.getItem(STORAGE_KEY_GUEST_ID);
  assert.equal(stored, guestId1, 'Guest ID must be persisted in AsyncStorage');

  // Second read should reuse the same ID (no regeneration)
  const guestId2 = await provider.getGuestId();
  assert.equal(guestId2, guestId1, 'Subsequent reads must return the identical Guest ID');
});

test('Guest Identity: IdentityProvider preserves Guest ID across simulated app restart', async () => {
  await AsyncStorage.clear();
  const provider1 = new IdentityProvider();
  const initialId = await provider1.getGuestId();

  // Simulate new process/app launch with empty memory cache
  const provider2 = new IdentityProvider();
  const restoredId = await provider2.getGuestId();

  assert.equal(restoredId, initialId, 'New IdentityProvider instance must load persisted Guest ID from storage');
});

test('Guest Identity: getCurrentIdentity and getIdentityHeaders emit X-Guest-ID', async () => {
  await AsyncStorage.clear();
  const provider = new IdentityProvider();
  const guestId = await provider.getGuestId();

  const identity = await provider.getCurrentIdentity();
  assert.equal(identity.type, 'guest');
  assert.equal(identity.userId, guestId);
  assert.deepEqual(identity.headers, {
    [HEADER_GUEST_ID]: guestId,
  });

  const headers = await provider.getIdentityHeaders();
  assert.equal(headers[HEADER_GUEST_ID], guestId);
});

test('Guest Identity: clear removes identity from both memory and storage', async () => {
  await AsyncStorage.clear();
  const provider = new IdentityProvider();
  const id1 = await provider.getGuestId();

  await provider.clear();
  const stored = await AsyncStorage.getItem(STORAGE_KEY_GUEST_ID);
  assert.equal(stored, null, 'Storage must be empty after clear');

  const id2 = await provider.getGuestId();
  assert.notEqual(id2, id1, 'New guest ID must be generated after clearing');
  assert.ok(isValidGuestId(id2));
});
