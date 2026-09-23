/**
 * Cross-Platform Identity Service
 *
 * Implements guest identity generation, persistence in AsyncStorage, and an IdentityProvider
 * abstraction designed for seamless future Auth0 integration across Web, iOS, and Android.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  IDENTITY_PREFIX_GUEST,
  IDENTITY_PREFIX_AUTH0,
  HEADER_GUEST_ID,
  HEADER_AUTHORIZATION,
  STORAGE_KEY_GUEST_ID,
  STORAGE_KEY_AUTH_TOKEN,
  UUID_V4_REGEX,
} from '../config/identityConstants';

export interface UserIdentity {
  readonly type: 'guest' | 'authenticated';
  readonly userId: string;
  readonly headers: Record<string, string>;
}

export interface IIdentityProvider {
  getCurrentIdentity(): Promise<UserIdentity>;
  getIdentityHeaders(): Promise<Record<string, string>>;
  getUserId(): Promise<string>;
  getGuestId(): Promise<string>;
  setGuestId(id: string): Promise<void>;
  getAuthToken(): Promise<string | null>;
  setAuthToken(token: string | null): Promise<void>;
  clear(): Promise<void>;
}

/**
 * Generates an RFC4122 v4 compliant UUID across all platforms (Web, Android, iOS, Node.js).
 */
export function generateUUID(): string {
  // 1. Web / Modern Node.js standard crypto.randomUUID
  if (typeof globalThis !== 'undefined' && globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID();
  }

  // 2. crypto.getRandomValues support
  if (typeof globalThis !== 'undefined' && globalThis.crypto?.getRandomValues) {
    const bytes = new Uint8Array(16);
    globalThis.crypto.getRandomValues(bytes);
    bytes[6] = (bytes[6] & 0x0f) | 0x40; // Version 4
    bytes[8] = (bytes[8] & 0x3f) | 0x80; // Variant 10xx
    const hex = Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  }

  // 3. Deterministic RFC4122 v4 math fallback
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Validates whether a given string is a valid guest identifier formatted as `guest|<uuid-v4>`.
 */
export function isValidGuestId(id: string): boolean {
  if (!id.startsWith(IDENTITY_PREFIX_GUEST)) {
    return false;
  }
  const rawUuid = id.slice(IDENTITY_PREFIX_GUEST.length);
  return UUID_V4_REGEX.test(rawUuid);
}

/**
 * IdentityProvider manages identity resolution and header generation.
 * AsyncStorage serves as the durable source of truth, backed by a write-through in-memory cache.
 */
export class IdentityProvider implements IIdentityProvider {
  private memoryGuestId: string | null = null;
  private memoryAuthToken: string | null = null;
  private initPromise: Promise<string> | null = null;

  /**
   * Retrieves or initializes the persistent Guest ID.
   * If not found, generates a new RFC4122 v4 UUID prefixed with `guest|`.
   */
  async getGuestId(): Promise<string> {
    if (this.memoryGuestId) {
      return this.memoryGuestId;
    }

    if (this.initPromise) {
      return this.initPromise;
    }

    this.initPromise = (async () => {
      try {
        const stored = await AsyncStorage.getItem(STORAGE_KEY_GUEST_ID);
        if (stored && isValidGuestId(stored)) {
          this.memoryGuestId = stored;
          return stored;
        }

        const newGuestId = `${IDENTITY_PREFIX_GUEST}${generateUUID()}`;
        await AsyncStorage.setItem(STORAGE_KEY_GUEST_ID, newGuestId);
        this.memoryGuestId = newGuestId;
        return newGuestId;
      } finally {
        this.initPromise = null;
      }
    })();

    return this.initPromise;
  }

  /**
   * Explicitly sets a guest ID (used for testing, migrations, or device pairing).
   */
  async setGuestId(id: string): Promise<void> {
    if (!isValidGuestId(id)) {
      throw new Error(`Invalid guest identity format: "${id}". Must be "${IDENTITY_PREFIX_GUEST}<uuid-v4>"`);
    }
    this.memoryGuestId = id;
    await AsyncStorage.setItem(STORAGE_KEY_GUEST_ID, id);
  }

  /**
   * Retrieves the current authentication token (Auth0 JWT), if configured.
   */
  async getAuthToken(): Promise<string | null> {
    if (this.memoryAuthToken !== null) {
      return this.memoryAuthToken;
    }
    const token = await AsyncStorage.getItem(STORAGE_KEY_AUTH_TOKEN);
    this.memoryAuthToken = token;
    return token;
  }

  /**
   * Sets or clears the authentication token.
   */
  async setAuthToken(token: string | null): Promise<void> {
    this.memoryAuthToken = token;
    if (token) {
      await AsyncStorage.setItem(STORAGE_KEY_AUTH_TOKEN, token);
    } else {
      await AsyncStorage.removeItem(STORAGE_KEY_AUTH_TOKEN);
    }
  }

  /**
   * Returns normalized user identifier (`guest|...` or `auth0|...`).
   */
  async getUserId(): Promise<string> {
    const identity = await this.getCurrentIdentity();
    return identity.userId;
  }

  /**
   * Returns current active identity representation.
   */
  async getCurrentIdentity(): Promise<UserIdentity> {
    const token = await this.getAuthToken();
    if (token) {
      // Future Auth0 token resolution placeholder
      let sub = 'authenticated-user';
      try {
        const parts = token.split('.');
        if (parts.length === 3) {
          const payload = JSON.parse(
            typeof atob === 'function'
              ? atob(parts[1])
              : Buffer.from(parts[1], 'base64').toString('utf-8')
          );
          if (payload.sub) {
            sub = payload.sub;
          }
        }
      } catch {
        // Fallback to placeholder sub if not decodable
      }

      const normalizedUserId = sub.startsWith(IDENTITY_PREFIX_AUTH0) ? sub : `${IDENTITY_PREFIX_AUTH0}${sub}`;
      return {
        type: 'authenticated',
        userId: normalizedUserId,
        headers: {
          [HEADER_AUTHORIZATION]: `Bearer ${token}`,
        },
      };
    }

    const guestId = await this.getGuestId();
    return {
      type: 'guest',
      userId: guestId,
      headers: {
        [HEADER_GUEST_ID]: guestId,
      },
    };
  }

  /**
   * Convenience helper returning the headers required for backend requests.
   */
  async getIdentityHeaders(): Promise<Record<string, string>> {
    const identity = await this.getCurrentIdentity();
    return identity.headers;
  }

  /**
   * Clears all identity state from memory and persistent storage.
   */
  async clear(): Promise<void> {
    this.memoryGuestId = null;
    this.memoryAuthToken = null;
    this.initPromise = null;
    await AsyncStorage.multiRemove([STORAGE_KEY_GUEST_ID, STORAGE_KEY_AUTH_TOKEN]);
  }
}

// Global default singleton instance
export const identityProvider = new IdentityProvider();

// Convenience functional exports
export const getGuestId = () => identityProvider.getGuestId();
export const getCurrentIdentity = () => identityProvider.getCurrentIdentity();
export const getIdentityHeaders = () => identityProvider.getIdentityHeaders();
export const getUserId = () => identityProvider.getUserId();
export const setAuthToken = (token: string | null) => identityProvider.setAuthToken(token);
export const clearIdentity = () => identityProvider.clear();
