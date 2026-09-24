/**
 * Auth0 Authentication Service
 *
 * Provides a production-grade Auth0 integration for React Native and Web:
 * - Login / Logout flows using react-native-auth0 SDK
 * - Silent token refresh and session restoration on app launch
 * - Durable session persistence via AsyncStorage
 * - Automatic one-time migration of guest preferences to Auth0 account
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  IDENTITY_PREFIX_AUTH0,
  IDENTITY_PREFIX_GUEST,
  STORAGE_KEY_GUEST_ID,
} from '../config/identityConstants';

export const STORAGE_KEY_AUTH0_SESSION = 'heatpath_auth0_session_v1';
export const STORAGE_KEY_MIGRATION_PREFIX = 'heatpath_migrated_guest_';

export type AuthErrorCode =
  | 'USER_CANCELLED'
  | 'NETWORK_ERROR'
  | 'SESSION_EXPIRED'
  | 'AUTH_FAILED'
  | 'MIGRATION_FAILED'
  | 'CONFIG_ERROR';

export class AuthError extends Error {
  readonly code: AuthErrorCode;
  constructor(code: AuthErrorCode, message: string) {
    super(message);
    this.code = code;
    this.name = 'AuthError';
    Object.setPrototypeOf(this, AuthError.prototype);
  }
}

export function classifyAuthError(err: any): AuthError {
  if (err instanceof AuthError) {
    return err;
  }
  const msg = String(err?.message || err?.error_description || err?.error || err || '');
  const code = String(err?.code || err?.name || '');

  if (
    code === 'a0.session.user_cancelled' ||
    code === 'USER_CANCELLED' ||
    /user_cancelled|user cancelled|cancel|dismiss|closed/i.test(msg) ||
    /cancel/i.test(code)
  ) {
    return new AuthError('USER_CANCELLED', 'Sign-in was cancelled.');
  }

  if (
    code === 'NETWORK_ERROR' ||
    /network|fetch|timeout|offline|failed to fetch|econnrefused|enetunreach|internet/i.test(msg)
  ) {
    return new AuthError(
      'NETWORK_ERROR',
      'Network connection unavailable. Please check your internet connection and retry.'
    );
  }

  if (
    code === 'SESSION_EXPIRED' ||
    /expired|invalid_grant|token expired|session expired|jwt expired/i.test(msg)
  ) {
    return new AuthError('SESSION_EXPIRED', 'Your authentication session has expired. Please sign in again.');
  }

  if (code === 'MIGRATION_FAILED' || /migration failed|preferences migration/i.test(msg)) {
    return new AuthError('MIGRATION_FAILED', msg || 'Failed to transfer guest preferences.');
  }

  if (code === 'CONFIG_ERROR' || /config|client_id|domain/i.test(msg)) {
    return new AuthError('CONFIG_ERROR', msg || 'Auth0 configuration is missing or invalid.');
  }

  return new AuthError('AUTH_FAILED', msg || 'Authentication failed. Please try again.');
}

export interface Auth0User {
  sub: string;
  name?: string;
  email?: string;
  picture?: string;
  [key: string]: any;
}

export interface Auth0Session {
  accessToken: string;
  idToken: string;
  refreshToken?: string;
  expiresAt: number; // Unix timestamp in milliseconds
  user: Auth0User;
}

export interface Auth0Config {
  domain: string;
  clientId: string;
  audience?: string;
}

export function getAuth0Config(): Auth0Config {
  return {
    domain: process.env.EXPO_PUBLIC_AUTH0_DOMAIN || process.env.AUTH0_DOMAIN || '',
    clientId: process.env.EXPO_PUBLIC_AUTH0_CLIENT_ID || process.env.AUTH0_CLIENT_ID || '',
    audience: process.env.EXPO_PUBLIC_AUTH0_AUDIENCE || process.env.AUTH0_AUDIENCE || '',
  };
}

export class Auth0Service {
  private currentSession: Auth0Session | null = null;
  private isRestoring = false;
  private restorePromise: Promise<Auth0Session | null> | null = null;
  private auth0Client: any = null;

  constructor() {
    this.initClient();
  }

  private initClient(): void {
    const config = getAuth0Config();
    if (config.domain && config.clientId) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const Auth0 = require('react-native-auth0').default || require('react-native-auth0');
        this.auth0Client = new Auth0({
          domain: config.domain,
          clientId: config.clientId,
        });
      } catch {
        // Non-native / test runner environment fallback
        this.auth0Client = null;
      }
    }
  }

  /**
   * Restores authenticated session on application startup.
   */
  async restoreSession(): Promise<Auth0Session | null> {
    if (this.currentSession) {
      return this.currentSession;
    }
    if (this.restorePromise) {
      return this.restorePromise;
    }

    this.restorePromise = (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY_AUTH0_SESSION);
        if (!raw) {
          return null;
        }

        const session: Auth0Session = JSON.parse(raw);
        const now = Date.now();

        // If session is still valid (with 60-second leeway), reuse it
        if (session.expiresAt > now + 60000) {
          this.currentSession = session;
          return session;
        }

        // If expired but refresh token exists, perform silent refresh
        if (session.refreshToken) {
          try {
            const refreshed = await this.refreshToken(session.refreshToken);
            return refreshed;
          } catch {
            await this.clearSession();
            return null;
          }
        }

        // Token expired without refresh token
        await this.clearSession();
        return null;
      } catch {
        await this.clearSession();
        return null;
      } finally {
        this.restorePromise = null;
      }
    })();

    return this.restorePromise;
  }

  /**
   * Performs silent token refresh using Auth0 refreshToken.
   */
  async refreshToken(existingRefreshToken?: string): Promise<Auth0Session> {
    const refreshToken = existingRefreshToken || this.currentSession?.refreshToken;
    if (!refreshToken) {
      throw new Error('Cannot refresh token: No refresh token available');
    }

    const config = getAuth0Config();
    if (!config.domain || !config.clientId) {
      throw new Error('Auth0 domain and clientId must be configured');
    }

    // Call Auth0 token endpoint via OAuth2 refresh_token grant
    const url = `https://${config.domain}/oauth/token`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        grant_type: 'refresh_token',
        client_id: config.clientId,
        refresh_token: refreshToken,
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Auth0 token refresh failed: ${err}`);
    }

    const data = await response.json();
    const expiresInSec = data.expires_in || 86400;

    const updatedSession: Auth0Session = {
      accessToken: data.access_token,
      idToken: data.id_token || this.currentSession?.idToken || '',
      refreshToken: data.refresh_token || refreshToken,
      expiresAt: Date.now() + expiresInSec * 1000,
      user: this.currentSession?.user || { sub: 'authenticated-user' },
    };

    await this.setSession(updatedSession);
    return updatedSession;
  }

  /**
   * Sets or overrides the Auth0 client instance (used for hermetic tests / mock setups).
   */
  setClient(client: any): void {
    this.auth0Client = client;
  }

  /**
   * Executes interactive Auth0 Login across Android, iOS, and Web.
   * Accurately classifies cancellations, network errors, and expired sessions into typed AuthErrors.
   */
  async login(options?: { skipMigration?: boolean; mockUser?: Auth0User }): Promise<Auth0Session> {
    if (options?.mockUser) {
      const session: Auth0Session = {
        accessToken: `mock-token-${Date.now()}`,
        idToken: `mock-id-token-${Date.now()}`,
        expiresAt: Date.now() + 3600000,
        user: options.mockUser,
      };
      await this.setSession(session);
      if (!options?.skipMigration) {
        await this.migrateGuestPreferencesIfPresent(session);
      }
      return session;
    }

    const config = getAuth0Config();
    let credentials: any = null;

    try {
      if (this.auth0Client?.webAuth?.authorize) {
        credentials = await this.auth0Client.webAuth.authorize({
          scope: 'openid profile email offline_access',
          audience: config.audience || undefined,
        });
      } else {
        throw new AuthError(
          'CONFIG_ERROR',
          'Auth0 client is not configured or Universal Login is unavailable in current runtime.'
        );
      }
    } catch (err: any) {
      throw classifyAuthError(err);
    }

    const sub = credentials?.idTokenPayload?.sub || credentials?.sub || 'user';
    const session: Auth0Session = {
      accessToken: credentials?.accessToken || 'token',
      idToken: credentials?.idToken || 'id-token',
      refreshToken: credentials?.refreshToken,
      expiresAt: Date.now() + (credentials?.expiresIn || 86400) * 1000,
      user: {
        sub,
        name: credentials?.idTokenPayload?.name || credentials?.name,
        email: credentials?.idTokenPayload?.email || credentials?.email,
        picture: credentials?.idTokenPayload?.picture || credentials?.picture,
      },
    };

    await this.setSession(session);

    // Trigger one-time migration of existing guest preferences unless skipped for explicit UI progress
    if (!options?.skipMigration) {
      await this.migrateGuestPreferencesIfPresent(session);
    }

    return session;
  }

  /**
   * Logs out the user from Auth0 and clears stored sessions.
   */
  async logout(): Promise<void> {
    try {
      if (this.auth0Client?.webAuth?.clearSession) {
        await this.auth0Client.webAuth.clearSession().catch(() => {});
      }
    } finally {
      await this.clearSession();
    }
  }

  /**
   * Manually sets session (used by tests or custom auth flows).
   */
  async setSession(session: Auth0Session): Promise<void> {
    this.currentSession = session;
    await AsyncStorage.setItem(STORAGE_KEY_AUTH0_SESSION, JSON.stringify(session));
  }

  /**
   * Clears active session.
   */
  async clearSession(): Promise<void> {
    this.currentSession = null;
    await AsyncStorage.removeItem(STORAGE_KEY_AUTH0_SESSION);
  }

  /**
   * Returns current valid access token, performing silent refresh if nearing expiration.
   */
  async getValidAccessToken(): Promise<string | null> {
    let session = this.currentSession || (await this.restoreSession());
    if (!session) {
      return null;
    }

    // Refresh if expiring in less than 30 seconds
    if (session.expiresAt <= Date.now() + 30000 && session.refreshToken) {
      try {
        session = await this.refreshToken();
      } catch {
        return null;
      }
    }

    return session.accessToken;
  }

  /**
   * Returns the current session or null.
   */
  getSession(): Auth0Session | null {
    return this.currentSession;
  }

  /**
   * Checks whether the given guest ID has preferences that need migration.
   */
  async needsMigration(guestIdOverride?: string): Promise<boolean> {
    try {
      const guestId = guestIdOverride || (await AsyncStorage.getItem(STORAGE_KEY_GUEST_ID));
      if (!guestId || !guestId.startsWith(IDENTITY_PREFIX_GUEST)) {
        return false;
      }

      const migrationKey = `${STORAGE_KEY_MIGRATION_PREFIX}${guestId}`;
      const alreadyMigrated = await AsyncStorage.getItem(migrationKey);
      if (alreadyMigrated === 'true') {
        return false;
      }

      const guestPrefKey = `heatpath_user_preferences_cache_${guestId}`;
      const guestRaw = await AsyncStorage.getItem(guestPrefKey);
      return Boolean(guestRaw && guestRaw !== '{}');
    } catch {
      return false;
    }
  }

  /**
   * Explicitly migrates guest preferences to the authenticated session.
   * Throws AuthError('MIGRATION_FAILED') if transfer fails so the caller can preserve data and retry.
   */
  async migrateGuestPreferences(session: Auth0Session, guestIdOverride?: string): Promise<boolean> {
    const guestId = guestIdOverride || (await AsyncStorage.getItem(STORAGE_KEY_GUEST_ID));
    if (!guestId || !guestId.startsWith(IDENTITY_PREFIX_GUEST)) {
      return false;
    }

    const migrationKey = `${STORAGE_KEY_MIGRATION_PREFIX}${guestId}`;
    const alreadyMigrated = await AsyncStorage.getItem(migrationKey);
    if (alreadyMigrated === 'true') {
      return false;
    }

    const guestPrefKey = `heatpath_user_preferences_cache_${guestId}`;
    const guestRaw = await AsyncStorage.getItem(guestPrefKey);

    if (guestRaw) {
      try {
        const guestPrefs = JSON.parse(guestRaw);
        const auth0UserId = session.user.sub.startsWith(IDENTITY_PREFIX_AUTH0)
          ? session.user.sub
          : `${IDENTITY_PREFIX_AUTH0}${session.user.sub}`;

        const auth0PrefKey = `heatpath_user_preferences_cache_${auth0UserId}`;
        await AsyncStorage.setItem(auth0PrefKey, JSON.stringify(guestPrefs));

        // Purge old guest preferences only after successful storage
        await AsyncStorage.removeItem(guestPrefKey);
      } catch (err: any) {
        throw new AuthError('MIGRATION_FAILED', `Failed to transfer guest preferences: ${err?.message || err}`);
      }
    }

    // Mark migration as completed so it never runs again for this guest
    await AsyncStorage.setItem(migrationKey, 'true');
    return true;
  }

  /**
   * One-time migration: Copies existing guest preferences into the Auth0 account on first sign-in.
   * Catches errors for backwards compatibility; use migrateGuestPreferences for granular error handling.
   */
  async migrateGuestPreferencesIfPresent(session: Auth0Session): Promise<boolean> {
    try {
      return await this.migrateGuestPreferences(session);
    } catch (e) {
      console.warn('[auth0] Guest preferences migration skipped:', e);
      return false;
    }
  }
}

export const auth0Service = new Auth0Service();
