import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { Map, MapPin, Clock, TrendingDown } from 'lucide-react-native';
import { colors } from '../theme/colors';
import { shadows, spacing } from '../theme/styles';

const ITEMS = [
  { key: 'heatmap', label: 'City Heat Map', sub: 'Live hot & cool zones', icon: Map, route: '/(tabs)/heatmap', dark: true },
  { key: 'spots', label: 'Cool Spots', sub: 'Shade & water near you', icon: MapPin, route: '/(tabs)/spots', dark: false },
  { key: 'besttime', label: 'Best time to go', sub: 'Heat by departure', icon: Clock, route: '/best-time', dark: false },
  { key: 'impact', label: 'Heat Saved', sub: 'Your weekly progress', icon: TrendingDown, route: '/(tabs)/impact', dark: true },
];

export default function ExploreGrid() {
  const router = useRouter();

  return (
    <View>
      <Text style={{ fontSize: 13, fontWeight: '700', color: colors.textSecondary, letterSpacing: 0.5, marginBottom: spacing.md }}>
        EXPLORE
      </Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
        {ITEMS.map(function (item) {
          const Icon = item.icon;
          return (
            <TouchableOpacity
              key={item.key}
              onPress={function () { router.push(item.route); }}
              style={{
                width: '47%', borderRadius: 18, padding: spacing.lg, minHeight: 100,
                backgroundColor: item.dark ? colors.darkSurface : colors.surface,
                justifyContent: 'space-between',
                ...shadows.sm,
              }}
            >
              <Icon size={20} color={item.dark ? colors.darkTextPrimary : colors.primary} />
              <View>
                <Text style={{
                  fontSize: 14, fontWeight: '700', marginTop: spacing.sm,
                  color: item.dark ? colors.darkTextPrimary : colors.textPrimary,
                }}>
                  {item.label}
                </Text>
                <Text style={{
                  fontSize: 11, marginTop: 2,
                  color: item.dark ? colors.darkTextSecondary : colors.textSecondary,
                }}>
                  {item.sub}
                </Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}