import { useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getProfile, updateProfile, type UserProfile } from '../config/api';

const PROFILE_KEY = 'heatpath_user_profile_cache';

const DEFAULT_PROFILE: UserProfile = {
  name: 'Alex River',
  email: 'alex.river@example.com',
  bio: 'Urban walker seeking shady streets and cool breezes.',
  avatar_id: 'tree',
};

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

  useEffect(() => {
    const listener: Listener = (newProfile) => {
      setProfile(newProfile);
    };
    listeners.add(listener);

    // 1. First load from AsyncStorage for instantaneous display
    AsyncStorage.getItem(PROFILE_KEY)
      .then((raw) => {
        if (raw) {
          try {
            const parsed = JSON.parse(raw);
            setProfile(parsed);
            cachedMemoryProfile = parsed;
          } catch {}
        }
      })
      .finally(() => {
        // 2. Fetch fresh from backend
        getProfile()
          .then((remote) => {
            setProfile(remote);
            broadcast(remote);
            AsyncStorage.setItem(PROFILE_KEY, JSON.stringify(remote)).catch(() => {});
            setError(null);
          })
          .catch((err) => {
            // If offline, we already loaded from AsyncStorage, so don't completely blank out
            if (!cachedMemoryProfile) {
              setError(err.message || 'Could not load profile');
            }
          })
          .finally(() => setLoading(false));
      });

    return () => {
      listeners.delete(listener);
    };
  }, []);

  const saveProfile = useCallback(async (data: Partial<UserProfile> & { name: string }) => {
    setSaving(true);
    setError(null);
    try {
      const updated = await updateProfile(data);
      setProfile(updated);
      broadcast(updated);
      await AsyncStorage.setItem(PROFILE_KEY, JSON.stringify(updated));
      return updated;
    } catch (e: any) {
      setError(e.message || 'Failed to save profile');
      throw e;
    } finally {
      setSaving(false);
    }
  }, []);

  const reloadProfile = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const remote = await getProfile();
      setProfile(remote);
      broadcast(remote);
      await AsyncStorage.setItem(PROFILE_KEY, JSON.stringify(remote));
    } catch (e: any) {
      setError(e.message || 'Failed to reload profile');
    } finally {
      setLoading(false);
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
