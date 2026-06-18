import { Platform } from 'react-native';

// Android emulator routes localhost through 10.0.2.2.
// For a physical device, replace with your machine's LAN IP.
export const API_BASE =
  Platform.OS === 'android' ? 'http://10.0.2.2:8000' : 'http://localhost:8000';
