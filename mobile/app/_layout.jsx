import { useEffect, useState } from 'react';
import { Stack, useRouter, useRootNavigationState } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import '../global.css';

export default function RootLayout() {
  const router = useRouter();
  const navState = useRootNavigationState();
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    if (!navState?.key) return;

    AsyncStorage.getItem('hasOnboarded').then((value) => {
      if (value !== 'true') {
        router.replace('/onboarding');
      }
      setChecked(true);
    });
  }, [navState?.key]);

  return <Stack screenOptions={{ headerShown: false }} />;
}
