import React, { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import {
  identityProvider,
  type UserIdentity,
} from '../services/identity';
import {
  auth0Service,
  classifyAuthError,
  type Auth0Session,
  type Auth0User,
  type AuthErrorCode,
} from '../services/auth0';
import { recordAuthenticationSuccess } from '../services/authPrompts';

export type MigrationStatus = 'idle' | 'migrating' | 'success' | 'error' | 'skipped';

export interface AuthContextType {
  // Identity & Session
  isAuthenticated: boolean;
  identity: UserIdentity | null;
  session: Auth0Session | null;
  userId: string;
  guestId: string | null;
  user: Auth0User | null;

  // Status flags
  isRestoring: boolean;
  isSigningIn: boolean;
  isSigningOut: boolean;
  migrationStatus: MigrationStatus;
  migrationError: string | null;

  // Error details
  error: string | null;
  errorCode: AuthErrorCode | null;

  // Actions
  login: (options?: { skipMigration?: boolean; mockUser?: Auth0User }) => Promise<void>;
  logout: () => Promise<void>;
  retryMigration: () => Promise<void>;
  clearError: () => void;
  restoreSession: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [identity, setIdentity] = useState<UserIdentity | null>(null);
  const [session, setSession] = useState<Auth0Session | null>(null);
  const [userId, setUserId] = useState<string>('');
  const [guestId, setGuestId] = useState<string | null>(null);
  const [user, setUser] = useState<Auth0User | null>(null);

  const [isRestoring, setIsRestoring] = useState<boolean>(true);
  const [isSigningIn, setIsSigningIn] = useState<boolean>(false);
  const [isSigningOut, setIsSigningOut] = useState<boolean>(false);
  const [migrationStatus, setMigrationStatus] = useState<MigrationStatus>('idle');
  const [migrationError, setMigrationError] = useState<string | null>(null);

  const [error, setError] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<AuthErrorCode | null>(null);

  const clearError = useCallback(() => {
    setError(null);
    setErrorCode(null);
    setMigrationError(null);
  }, []);

  /**
   * Restores session on app startup:
   * - Attempts to restore persistent Auth0 session (with silent refresh if needed).
   * - If found: switches to authenticated state immediately.
   * - If not found: restores or creates persistent Guest ID and enters guest mode.
   * Seamless and non-blocking with zero unnecessary login prompts.
   */
  const restoreSession = useCallback(async () => {
    setIsRestoring(true);
    try {
      const restored = await identityProvider.restoreSession();
      const currentGuestId = await identityProvider.getGuestId();
      setGuestId(currentGuestId);

      if (restored) {
        setSession(restored);
        setUser(restored.user);
        setIsAuthenticated(true);
        recordAuthenticationSuccess().catch(() => {});
        const resolvedIdentity = await identityProvider.getCurrentIdentity();
        setIdentity(resolvedIdentity);
        setUserId(resolvedIdentity.userId);
      } else {
        setSession(null);
        setUser(null);
        setIsAuthenticated(false);
        const resolvedIdentity = await identityProvider.getCurrentIdentity();
        setIdentity(resolvedIdentity);
        setUserId(resolvedIdentity.userId);
      }
    } catch (err: any) {
      console.warn('[AuthContext] Session restore encountered error, falling back to guest:', err?.message);
      const fallbackGuestId = await identityProvider.getGuestId();
      setGuestId(fallbackGuestId);
      setUserId(fallbackGuestId);
      setIsAuthenticated(false);
    } finally {
      setIsRestoring(false);
    }
  }, []);

  // Run session restoration once on mount
  useEffect(() => {
    restoreSession();

    // Listen to identity events (e.g. from background token refresh or external identity sync)
    const unsub = identityProvider.subscribe(async (newIdentity) => {
      setIdentity(newIdentity);
      setUserId(newIdentity.userId);
      if (newIdentity.type === 'authenticated') {
        setIsAuthenticated(true);
        const activeSession = auth0Service.getSession();
        if (activeSession) {
          setSession(activeSession);
          setUser(activeSession.user);
        }
      } else {
        setIsAuthenticated(false);
        setSession(null);
        setUser(null);
      }
    });

    return () => {
      unsub();
    };
  }, [restoreSession]);

  /**
   * Performs interactive login via Auth0 Universal Login across Android, iOS, and Web.
   * Handles success, cancellation, network failure, and guest preference migration.
   */
  const login = useCallback(
    async (options?: { skipMigration?: boolean; mockUser?: Auth0User }) => {
      clearError();
      setIsSigningIn(true);

      try {
        // Step 1: Perform Auth0 interactive login
        const newSession = await identityProvider.login({
          skipMigration: true, // We handle migration explicitly below to present UI feedback
          mockUser: options?.mockUser,
        });

        setSession(newSession);
        setUser(newSession.user);
        setIsAuthenticated(true);
        recordAuthenticationSuccess().catch(() => {});

        const newIdentity = await identityProvider.getCurrentIdentity();
        setIdentity(newIdentity);
        setUserId(newIdentity.userId);

        // Step 2: Check if guest preferences should be transferred
        const needsTransfer = await auth0Service.needsMigration();
        if (needsTransfer) {
          setMigrationStatus('migrating');
          try {
            await auth0Service.migrateGuestPreferences(newSession);
            setMigrationStatus('success');
          } catch (migErr: any) {
            console.warn('[AuthContext] Guest preference migration failed:', migErr);
            setMigrationStatus('error');
            setMigrationError('Could not transfer guest preferences. Your local preferences were preserved.');
          }
        } else {
          setMigrationStatus('skipped');
        }
      } catch (err: any) {
        const classified = classifyAuthError(err);
        setErrorCode(classified.code);

        if (classified.code === 'USER_CANCELLED') {
          setError('Sign-in cancelled.');
        } else if (classified.code === 'NETWORK_ERROR') {
          setError('Network connection unavailable. Please check your internet connection and retry.');
        } else if (classified.code === 'SESSION_EXPIRED') {
          setError('Your previous session has expired. Please sign in again.');
        } else {
          setError(classified.message || 'Authentication failed. Please try again.');
        }
        throw classified;
      } finally {
        setIsSigningIn(false);
      }
    },
    [clearError]
  );

  /**
   * Retries preference migration if the initial migration failed.
   */
  const retryMigration = useCallback(async () => {
    if (!session) return;
    setMigrationStatus('migrating');
    setMigrationError(null);
    try {
      await auth0Service.migrateGuestPreferences(session);
      setMigrationStatus('success');
    } catch (migErr: any) {
      setMigrationStatus('error');
      setMigrationError('Retry failed: Could not transfer guest preferences.');
    }
  }, [session]);

  /**
   * Logs out from Auth0 and transitions smoothly back to Guest identity.
   * Reloads guest identity without requiring an application restart.
   */
  const logout = useCallback(async () => {
    clearError();
    setIsSigningOut(true);
    setMigrationStatus('idle');

    try {
      await identityProvider.logout();
      const currentGuestId = await identityProvider.getGuestId();
      setGuestId(currentGuestId);
      setSession(null);
      setUser(null);
      setIsAuthenticated(false);
      const guestIdentity = await identityProvider.getCurrentIdentity();
      setIdentity(guestIdentity);
      setUserId(guestIdentity.userId);
    } catch (err: any) {
      console.warn('[AuthContext] Logout warning:', err);
    } finally {
      setIsSigningOut(false);
    }
  }, [clearError]);

  const value: AuthContextType = {
    isAuthenticated,
    identity,
    session,
    userId,
    guestId,
    user,
    isRestoring,
    isSigningIn,
    isSigningOut,
    migrationStatus,
    migrationError,
    error,
    errorCode,
    login,
    logout,
    retryMigration,
    clearError,
    restoreSession,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    // Graceful fallback for components or tests running outside AuthProvider
    return {
      isAuthenticated: false,
      identity: null,
      session: auth0Service.getSession(),
      userId: '',
      guestId: null,
      user: null,
      isRestoring: false,
      isSigningIn: false,
      isSigningOut: false,
      migrationStatus: 'idle',
      migrationError: null,
      error: null,
      errorCode: null,
      login: async () => {},
      logout: async () => {},
      retryMigration: async () => {},
      clearError: () => {},
      restoreSession: async () => {},
    };
  }
  return context;
}
