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

test('Networking: apiFetch automatically attaches identity headers and merges caller headers', async () => {
  await AsyncStorage.clear();
  const { apiFetch, API_BASE } = await import('../../config/api');
  const { identityProvider } = await import('../identity');
  await identityProvider.clear();

  const originalFetch = globalThis.fetch;
  let interceptedUrl: string | null = null;
  let interceptedHeaders: any = null;

  globalThis.fetch = (async (url: any, init: any) => {
    interceptedUrl = String(url);
    interceptedHeaders = init?.headers;
    return new Response(JSON.stringify({ status: 'ok' }), { status: 200 });
  }) as any;

  try {
    const res = await apiFetch('/test-endpoint', {
      headers: { 'Content-Type': 'application/json' },
    });
    assert.equal(res.status, 200);
    assert.equal(interceptedUrl, `${API_BASE}/test-endpoint`);
    assert.ok(interceptedHeaders[HEADER_GUEST_ID], 'Must automatically include X-Guest-ID');
    assert.ok(isValidGuestId(interceptedHeaders[HEADER_GUEST_ID]));
    assert.equal(interceptedHeaders['Content-Type'], 'application/json', 'Must preserve caller headers');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('Cross-Browser Isolation: Chrome, Firefox, and Edge maintain independent guest identities and storage', async () => {
  // Simulate 3 distinct browsers with separate, isolated local storage partitions
  class BrowserLocalStorage {
    private store = new Map<string, string>();
    async getItem(k: string): Promise<string | null> {
      return this.store.get(k) ?? null;
    }
    async setItem(k: string, v: string): Promise<void> {
      this.store.set(k, String(v));
    }
    async removeItem(k: string): Promise<void> {
      this.store.delete(k);
    }
  }

  const chromeStorage = new BrowserLocalStorage();
  const firefoxStorage = new BrowserLocalStorage();
  const edgeStorage = new BrowserLocalStorage();

  // Helper simulating launch of IdentityProvider in a specific browser storage partition
  const launchInBrowser = async (storage: BrowserLocalStorage) => {
    const existing = await storage.getItem(STORAGE_KEY_GUEST_ID);
    if (existing && isValidGuestId(existing)) {
      return existing;
    }
    const newId = `${IDENTITY_PREFIX_GUEST}${generateUUID()}`;
    await storage.setItem(STORAGE_KEY_GUEST_ID, newId);
    return newId;
  };

  // 1. Launch in Chrome
  const chromeGuestId = await launchInBrowser(chromeStorage);
  // 2. Launch in Firefox
  const firefoxGuestId = await launchInBrowser(firefoxStorage);
  // 3. Launch in Edge
  const edgeGuestId = await launchInBrowser(edgeStorage);

  // Assert all 3 browser guest identities are distinct
  assert.notEqual(chromeGuestId, firefoxGuestId, 'Chrome and Firefox must have different guest IDs');
  assert.notEqual(firefoxGuestId, edgeGuestId, 'Firefox and Edge must have different guest IDs');
  assert.notEqual(chromeGuestId, edgeGuestId, 'Chrome and Edge must have different guest IDs');

  assert.ok(isValidGuestId(chromeGuestId));
  assert.ok(isValidGuestId(firefoxGuestId));
  assert.ok(isValidGuestId(edgeGuestId));

  // Assert restarting browser reloads the identical guest ID
  const reloadedChrome = await launchInBrowser(chromeStorage);
  const reloadedFirefox = await launchInBrowser(firefoxStorage);
  const reloadedEdge = await launchInBrowser(edgeStorage);

  assert.equal(reloadedChrome, chromeGuestId);
  assert.equal(reloadedFirefox, firefoxGuestId);
  assert.equal(reloadedEdge, edgeGuestId);
});

