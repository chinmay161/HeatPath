import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from './Icon';
import { colors, fonts, radius } from '../theme/colors';

const NAV_ITEMS = [
  { key: 'home', label: 'Home', icon: 'home' },
  { key: 'routes', label: 'Routes', icon: 'routes' },
  { key: 'map', label: 'Heat map', icon: 'heatmap' },
  { key: 'impact', label: 'Impact', icon: 'chart' },
  { key: 'profile', label: 'Profile', icon: 'user' },
] as const;

interface AppSidebarProps {
  active: string;
  onNav: (key: string) => void;
}

export function AppSidebar({ active, onNav }: AppSidebarProps) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.sidebar, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 16 }]}>
      {/* Brand */}
      <View style={styles.brand}>
        <View style={styles.logoBox}>
          <Icon name="shade" size={18} stroke={colors.lime} width={2.2} />
        </View>
        <Text style={styles.brandName}>HeatPath</Text>
      </View>

      {/* Nav items */}
      <View style={styles.nav}>
        {NAV_ITEMS.map((item) => {
          const isActive = active === item.key;
          return (
            <TouchableOpacity
              key={item.key}
              onPress={() => onNav(item.key)}
              style={[styles.navItem, isActive && styles.navItemActive]}
              activeOpacity={0.7}
            >
              <Icon
                name={item.icon}
                size={19}
                stroke={isActive ? '#16633B' : '#5d6f62'}
                width={2.1}
              />
              <Text style={[styles.navLabel, isActive && styles.navLabelActive]}>
                {item.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Profile footer */}
      <View style={styles.meCard}>
        <View style={styles.meAvatar}>
          <Icon name="user" size={18} stroke={colors.forest} width={2} />
        </View>
        <View>
          <Text style={styles.meName}>Aanya R.</Text>
          <Text style={styles.meMeta}>Heat-sensitive</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  sidebar: {
    width: 236,
    backgroundColor: '#FBFCF9',
    borderRightWidth: 1,
    borderRightColor: '#EAEFE5',
    paddingHorizontal: 16,
    flexDirection: 'column',
  },
  brand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 6,
    paddingBottom: 18,
  },
  logoBox: {
    width: 32,
    height: 32,
    borderRadius: 9,
    backgroundColor: colors.forestDeep,
    alignItems: 'center',
    justifyContent: 'center',
    // gradient approximated with solid color
    backgroundImage: `linear-gradient(150deg, ${colors.forest}, ${colors.forestDeep})`,
  } as any,
  brandName: {
    fontFamily: fonts.display,
    fontSize: 19,
    color: '#102b1e',
  },
  nav: {
    gap: 3,
    marginTop: 6,
    flex: 1,
  },
  navItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    paddingVertical: 11,
    paddingHorizontal: 13,
    borderRadius: radius.sm,
  },
  navItemActive: {
    backgroundColor: '#E6F4E2',
  },
  navLabel: {
    fontFamily: fonts.uiSemiBold,
    fontSize: 14,
    color: '#5d6f62',
  },
  navLabelActive: {
    fontFamily: fonts.uiBold,
    color: '#16633B',
  },
  meCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 10,
    borderRadius: 14,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#EAEFE5',
    marginTop: 'auto',
  } as any,
  meAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#E6F4E2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  meName: {
    fontFamily: fonts.uiBold,
    fontSize: 13,
    color: colors.ink,
  },
  meMeta: {
    fontFamily: fonts.ui,
    fontSize: 11,
    color: colors.muted2,
  },
});
