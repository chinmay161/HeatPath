import { useState, useEffect } from 'react';
import * as Location from 'expo-location';
import { getConditions } from '../api/heatpath';
import { reverseGeocode } from '../api/geocoding';

export function useCurrentConditions() {
  const [location, setLocation] = useState(null);
  const [conditions, setConditions] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const permission = await Location.requestForegroundPermissionsAsync();
        if (permission.status !== 'granted') {
          if (!cancelled) {
            setError('permission_denied');
            setLoading(false);
          }
          return;
        }

        const loc = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        const latitude = loc.coords.latitude;
        const longitude = loc.coords.longitude;

        const label = await reverseGeocode(latitude, longitude);

        if (cancelled) return;
        setLocation({ lat: latitude, lon: longitude, label: label || 'Your area' });

        const data = await getConditions(latitude, longitude);
        if (cancelled) return;
        setConditions(data);
        setLoading(false);
      } catch (e) {
        if (!cancelled) {
          setError('failed');
          setLoading(false);
        }
      }
    }

    load();
    return function cleanup() { cancelled = true; };
  }, []);

  return { location, conditions, loading, error };
}
