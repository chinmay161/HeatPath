import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from './Icon';
import { colors, fonts } from '../theme/colors';

const TABS = [
  { key: 'home', label: 'Home', icon: 'home' },
  { key: 'routes', label: 'Routes', icon: 'routes' },
  { key: 'map', label: 'Map', icon: 'heatmap' },
  { key: 'impact', label: 'Impact', icon: 'chart' },
  { key: 'profile', label: 'Profile', icon: 'user' },
] as const;

interface AppTabBarProps {
  active: string;
  onNav: (key: string) => void;
  dark?: boolean;
  // expo-router Tabs tabBar props (ignored — we use active/onNav directly)
  [key: string]: any;
}

export function AppTabBar({ active, onNav, dark = false }: AppTabBarProps) {
  const insets = useSafeAreaInsets();

  return (
    <View
      style={[
        styles.container,
        dark && styles.containerDark,
        { paddingBottom: insets.bottom + 8 },
      ]}
    >
      {TABS.map((tab) => {
        const isActive = active === tab.key;
        const iconColor = dark
          ? isActive ? colors.lime : '#6f8579'
          : isActive ? colors.forest : '#9aa89d';
        const labelColor = iconColor;

        return (
          <TouchableOpacity
            key={tab.key}
            onPress={() => onNav(tab.key)}
            style={styles.tab}
            activeOpacity={0.7}
          >
            <Icon name={tab.icon} size={22} stroke={iconColor} width={2.1} />
            <Text
              style={[
                styles.label,
                { color: labelColor, fontFamily: isActive ? fonts.uiBold : fonts.uiSemiBold },
              ]}
            >
              {tab.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: colors.line,
    paddingHorizontal: 8,
    paddingTop: 11,
    // Web shadow
    boxShadow: '0 -4px 20px -8px rgba(20,40,30,0.3)',
    shadowColor: '#14281e',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 8,
  } as any,
  containerDark: {
    backgroundColor: colors.slateCard,
    borderTopColor: colors.slateLine,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  label: {
    fontSize: 10,
    fontWeight: '600',
  },
});
