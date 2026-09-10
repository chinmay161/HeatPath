import { Platform } from 'react-native';
import * as Location from 'expo-location';
import type { LocationPermission } from './types';

/**
 * Checks current location permission without prompting the user.
 */
export async function checkLocationPermissions(): Promise<LocationPermission> {
  try {
    if (Platform.OS === 'web') {
      if (typeof navigator === 'undefined' || !navigator.permissions) {
        return 'unknown';
      }
      try {
        const status = await navigator.permissions.query({ name: 'geolocation' as PermissionName });
        if (status.state === 'granted') return 'granted';
        if (status.state === 'denied') return 'denied';
        return 'unknown';
      } catch {
        return 'unknown';
      }
    }

    const { status } = await Location.getForegroundPermissionsAsync();
    switch (status) {
      case Location.PermissionStatus.GRANTED:
        return 'granted';
      case Location.PermissionStatus.DENIED:
        return 'denied';
      case Location.PermissionStatus.UNDETERMINED:
        return 'unknown';
      default:
        return 'denied';
    }
  } catch (error) {
    if (__DEV__) {
      console.warn('[checkLocationPermissions] Error checking permissions:', error);
    }
    return 'unknown';
  }
}

/**
 * Requests foreground location permission from the device/user.
 */
export async function requestLocationPermissions(): Promise<LocationPermission> {
  try {
    if (Platform.OS === 'web') {
      if (typeof navigator === 'undefined' || !navigator.geolocation) {
        return 'denied';
      }
      // On web, a geolocation call prompts the user
      return new Promise<LocationPermission>((resolve) => {
        navigator.geolocation.getCurrentPosition(
          () => resolve('granted'),
          (err) => {
            if (err.code === 1) {
              resolve('denied'); // PERMISSION_DENIED
            } else {
              resolve('unknown');
            }
          },
          { timeout: 10_000 }
        );
      });
    }

    const { status, canAskAgain } = await Location.requestForegroundPermissionsAsync();
    if (status === Location.PermissionStatus.GRANTED) {
      return 'granted';
    }
    if (!canAskAgain) {
      return 'restricted';
    }
    return 'denied';
  } catch (error) {
    if (__DEV__) {
      console.warn('[requestLocationPermissions] Error requesting permissions:', error);
    }
    return 'denied';
  }
}

/**
 * Verifies if location hardware services (GPS / location toggle) are enabled on the device.
 */
export async function isLocationServicesEnabled(): Promise<boolean> {
  try {
    if (Platform.OS === 'web') {
      return typeof navigator !== 'undefined' && 'geolocation' in navigator;
    }
    return await Location.hasServicesEnabledAsync();
  } catch {
    return true; // Assume enabled if check fails to prevent false blockage
  }
}

/**
 * Generates user-friendly instructional messaging for permission issues.
 */
export function getPermissionErrorMessage(
  permission: LocationPermission,
  servicesEnabled: boolean
): string | null {
  if (!servicesEnabled) {
    return 'Location services are turned off. Please enable GPS in your device settings to start navigation.';
  }

  switch (permission) {
    case 'denied':
      return 'Location access was denied. HeatPath needs GPS to guide you along shaded paths.';
    case 'restricted':
      return 'Location permission is restricted. Please enable location access for HeatPath in your system settings.';
    default:
      return null;
  }
}
