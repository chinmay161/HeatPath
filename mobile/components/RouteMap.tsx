import React from 'react';
import { View, Text } from 'react-native';
import { colors, fonts } from '../theme/colors';

// Native platforms: map not available yet (react-leaflet is web-only).
// The desktop layout that renders RouteMap only shows on web, so this
// fallback is a safety net rather than a path users hit in practice.
type Props = {
  routes?: { path: { lat: number; lon: number }[] }[];
  selectedIdx?: number;
  startLat?: number | null;
  startLon?: number | null;
  endLat?: number | null;
  endLon?: number | null;
  routeTitle?: string;
};

export function RouteMap(_props: Props) {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#DDE8D2' }}>
      <Text style={{ fontFamily: fonts.uiSemiBold, fontSize: 13, color: colors.muted }}>
        Map available on web
      </Text>
    </View>
  );
}
