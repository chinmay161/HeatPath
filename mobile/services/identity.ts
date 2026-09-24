/**
 * Cross-Platform Identity Service
 *
 * Implements guest identity generation, persistence in AsyncStorage, and an IdentityProvider
 * abstraction with full Auth0 authentication integration across Web, iOS, and Android.
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
import { auth0Service, type Auth0Session } from './auth0';

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
  login(): Promise<Auth0Session>;
  logout(): Promise<void>;
  restoreSession(): Promise<Auth0Session | null>;
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
export type IdentityChangeListener = (identity: UserIdentity) => void;

export class IdentityProvider implements IIdentityProvider {
  private memoryGuestId: string | null = null;
  private memoryAuthToken: string | null = null;
  private initPromise: Promise<string> | null = null;
  private listeners: Set<IdentityChangeListener> = new Set();

  /**
   * Subscribes a listener to identity changes (e.g. login, logout, clear).
   * Returns an unsubscribe function.
   */
  subscribe(listener: IdentityChangeListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Broadcasts an identity change to all registered subscribers.
   */
  notify(identity: UserIdentity): void {
    this.listeners.forEach((listener) => {
      try {
        listener(identity);
      } catch (err) {
        console.error('[identityProvider] Error in listener callback:', err);
      }
    });
  }

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
    const identity = await this.getCurrentIdentity();
    this.notify(identity);
  }

  /**
   * Restores authenticated session on launch.
   */
  async restoreSession(): Promise<Auth0Session | null> {
    const session = await auth0Service.restoreSession();
    if (session) {
      const identity = await this.getCurrentIdentity();
      this.notify(identity);
    }
    return session;
  }

  /**
   * Performs Auth0 interactive login across Android, iOS, and Web.
   */
  async login(options?: { skipMigration?: boolean; mockUser?: any }): Promise<Auth0Session> {
    const session = await auth0Service.login(options);
    const newIdentity = await this.getCurrentIdentity();
    this.notify(newIdentity);
    return session;
  }

  /**
   * Performs Auth0 logout and returns seamlessly to guest mode without app restart.
   */
  async logout(): Promise<void> {
    await auth0Service.logout();
    this.memoryAuthToken = null;
    await AsyncStorage.removeItem(STORAGE_KEY_AUTH_TOKEN);
    const guestIdentity = await this.getCurrentIdentity();
    this.notify(guestIdentity);
  }

  /**
   * Retrieves the current authentication token (Auth0 JWT), if configured.
   */
  async getAuthToken(): Promise<string | null> {
    // 1. Check Auth0 active session first
    const activeToken = await auth0Service.getValidAccessToken();
    if (activeToken) {
      return activeToken;
    }

    // 2. Check explicit token override in memory / storage
    if (this.memoryAuthToken !== null) {
      return this.memoryAuthToken;
    }
    const token = await AsyncStorage.getItem(STORAGE_KEY_AUTH_TOKEN);
    this.memoryAuthToken = token;
    return token;
  }

  /**
   * Sets or clears the authentication token manually.
   */
  async setAuthToken(token: string | null): Promise<void> {
    this.memoryAuthToken = token;
    if (token) {
      await AsyncStorage.setItem(STORAGE_KEY_AUTH_TOKEN, token);
    } else {
      await AsyncStorage.removeItem(STORAGE_KEY_AUTH_TOKEN);
      await auth0Service.clearSession();
    }
    const identity = await this.getCurrentIdentity();
    this.notify(identity);
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
      const session = auth0Service.getSession();
      let sub = session?.user?.sub || 'authenticated-user';

      if (!session) {
        // Attempt to parse sub claim from JWT payload
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
          // Fallback to placeholder if token is opaque or mock
        }
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
    await auth0Service.clearSession();
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
export const login = (options?: { skipMigration?: boolean; mockUser?: any }) => identityProvider.login(options);
export const logout = () => identityProvider.logout();
export const restoreSession = () => identityProvider.restoreSession();
export const subscribeToIdentity = (listener: IdentityChangeListener) => identityProvider.subscribe(listener);
