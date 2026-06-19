import { useState, useEffect } from 'react';
import { Platform } from 'react-native';
import * as Location from 'expo-location';

export type LatLon = { lat: number; lon: number };

export type UserLocationState = {
  location: LatLon | null;
  locationLabel: string | null;
  loading: boolean;
  error: string | null;
};

function getWebPosition(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      reject(new Error('Location is not supported by this browser'));
      return;
    }

    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: false,
      maximumAge: 60_000,
      timeout: 15_000,
    });
  });
}

function locationErrorMessage(error: unknown): string {
  const geolocationError = error as Partial<GeolocationPositionError>;
  if (geolocationError?.code === 1) {
    return 'Location permission denied. Allow location access in your browser and reload.';
  }
  if (geolocationError?.code === 2) {
    return 'Your location could not be determined. Check your device location settings.';
  }
  if (geolocationError?.code === 3) {
    return 'Location request timed out. Check your device location settings and reload.';
  }
  return error instanceof Error ? error.message : 'Location unavailable';
}

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
        // expo-location's web permission request can remain pending forever and
        // then performs a second browser position request. Use the browser API
        // directly so the prompt happens once and always has a timeout.
        const pos = Platform.OS === 'web'
          ? await getWebPosition()
          : await (async () => {
              const { status } = await Location.requestForegroundPermissionsAsync();
              if (status !== 'granted') throw new Error('Location permission denied');
              return Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
            })();
        const { latitude: lat, longitude: lon } = pos.coords;

        let locationLabel: string | null = null;
        try {
          if (Platform.OS === 'web') throw new Error('Reverse geocoding is unavailable on web');
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
          setState(s => ({ ...s, loading: false, error: locationErrorMessage(e) }));
        }
      }
    })();

    return () => { cancelled = true; };
  }, []);

  return state;
}
