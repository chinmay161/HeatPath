import { useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getProfile, updateProfile, type UserProfile } from '../config/api';
import { identityProvider } from '../services/identity';

const PROFILE_KEY = 'heatpath_user_profile_cache';

async function getProfileStorageKey(): Promise<string> {
  try {
    const userId = await identityProvider.getUserId();
    return `${PROFILE_KEY}_${userId}`;
  } catch {
    return PROFILE_KEY;
  }
}

export const DEFAULT_PROFILE: UserProfile = {
  name: 'Guest',
  email: null,
  bio: 'Urban walker seeking shady streets and cool breezes.',
  avatar_id: 'tree',
};

export function normalizeProfile(p: any): UserProfile {
  const rawName = typeof p?.name === 'string' ? p.name.trim() : '';
  const rawEmail = typeof p?.email === 'string' ? p.email.trim() : '';
  return {
    name: (!rawName || rawName === 'Alex River') ? 'Guest' : rawName,
    email: (!rawEmail || rawEmail === 'alex.river@example.com') ? null : rawEmail,
    bio: p?.bio || DEFAULT_PROFILE.bio,
    avatar_id: p?.avatar_id || 'tree',
  };
}

// Simple in-memory listeners for cross-component re-renders
type Listener = (profile: UserProfile) => void;
const listeners = new Set<Listener>();

let cachedMemoryProfile: UserProfile | null = null;

function broadcast(profile: UserProfile) {
  cachedMemoryProfile = profile;
  listeners.forEach(fn => fn(profile));
}

export function useUserProfile() {
  const [profile, setProfile] = useState<UserProfile>(cachedMemoryProfile || DEFAULT_PROFILE);
  const [loading, setLoading] = useState<boolean>(!cachedMemoryProfile);
  const [saving, setSaving] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const reloadProfile = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const storageKey = await getProfileStorageKey();
      const raw = await AsyncStorage.getItem(storageKey);
      if (raw) {
        try {
          const parsed = normalizeProfile(JSON.parse(raw));
          setProfile(parsed);
          broadcast(parsed);
        } catch {}
      }

      const remote = normalizeProfile(await getProfile());
      setProfile(remote);
      broadcast(remote);
      await AsyncStorage.setItem(storageKey, JSON.stringify(remote)).catch(() => {});
    } catch (e: any) {
      if (!cachedMemoryProfile) {
        setError(e.message || 'Failed to reload profile');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const listener: Listener = (newProfile) => {
      setProfile(newProfile);
    };
    listeners.add(listener);

    // Initial load
    reloadProfile();

    // Re-fetch profile immediately whenever identity changes (login, logout)
    const unsubIdentity = identityProvider.subscribe((newIdentity) => {
      cachedMemoryProfile = null;
      if (newIdentity.type === 'guest') {
        broadcast(DEFAULT_PROFILE);
      }
      reloadProfile();
    });

    return () => {
      listeners.delete(listener);
      unsubIdentity();
    };
  }, [reloadProfile]);

  const saveProfile = useCallback(async (data: Partial<UserProfile> & { name: string }) => {
    setSaving(true);
    setError(null);
    try {
      const updated = await updateProfile(data);
      setProfile(updated);
      broadcast(updated);
      const storageKey = await getProfileStorageKey();
      await AsyncStorage.setItem(storageKey, JSON.stringify(updated)).catch(() => {});
      return updated;
    } catch (e: any) {
      setError(e.message || 'Failed to save profile');
      throw e;
    } finally {
      setSaving(false);
    }
  }, []);

  return {
    profile,
    loading,
    saving,
    error,
    saveProfile,
    reloadProfile,
  };
}
