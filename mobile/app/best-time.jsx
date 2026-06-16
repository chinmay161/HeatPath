import { useEffect } from 'react';
import { View, Text, ActivityIndicator } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { colors } from '../theme/colors';

export default function BestTime() {
  const router = useRouter();
  const params = useLocalSearchParams();

  const hasRoute = params.startLat && params.startLon && params.endLat && params.endLon;

  useEffect(function () {
    if (!hasRoute) {
      router.replace('/(tabs)');
    }
  }, [hasRoute]);

  if (!hasRoute) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background }}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background }}>
      <Text style={{ fontSize: 18, color: colors.textPrimary }}>
        Route: {params.startLabel} to {params.endLabel}
      </Text>
      <Text style={{ fontSize: 13, color: colors.textSecondary, marginTop: 8 }}>
        Full Best Time screen coming next.
      </Text>
    </View>
  );
}
