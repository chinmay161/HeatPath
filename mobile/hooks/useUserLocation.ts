import { useState, useEffect } from 'react';
import * as Location from 'expo-location';

export type LatLon = { lat: number; lon: number };

export type UserLocationState = {
  location: LatLon | null;
  locationLabel: string | null;
  loading: boolean;
  error: string | null;
};

export function useUserLocation(): UserLocationState {
  const [state, setState] = useState<UserLocationState>({
    location: null,
    locationLabel: null,
    loading: true,
    error: null,
  });

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          if (!cancelled) setState(s => ({ ...s, loading: false, error: 'Location permission denied' }));
          return;
        }

        const pos = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        const { latitude: lat, longitude: lon } = pos.coords;

        let locationLabel: string | null = null;
        try {
          const [place] = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lon });
          locationLabel =
            [place.district, place.city].filter(Boolean).join(', ') ||
            place.region ||
            null;
        } catch {
          // reverse-geocode failure is non-fatal; coordinates are still usable
        }

        if (!cancelled) {
          setState({ location: { lat, lon }, locationLabel, loading: false, error: null });
        }
      } catch (e: any) {
        if (!cancelled) {
          setState(s => ({ ...s, loading: false, error: e?.message ?? 'Location unavailable' }));
        }
      }
    })();

    return () => { cancelled = true; };
  }, []);

  return state;
}
