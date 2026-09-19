/**
 * EnvironmentalLegend.tsx
 *
 * Compact legend explaining environmental path colors along the route:
 * - Shaded green: tree canopy & building shadows
 * - Exposed orange: direct solar exposure
 * - Caution red: high heat index
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { fonts } from '../../theme/colors';

export function EnvironmentalLegend() {
  return (
    <View style={styles.container}>
      <View style={styles.item}>
        <View style={[styles.swatch, { backgroundColor: '#16A34A' }]} />
        <Text style={styles.label}>Shaded</Text>
      </View>

      <View style={styles.item}>
        <View style={[styles.swatch, { backgroundColor: '#F97316' }]} />
        <Text style={styles.label}>Exposed</Text>
      </View>

      <View style={styles.item}>
        <View style={[styles.swatch, { backgroundColor: '#EF4444' }]} />
        <Text style={styles.label}>Caution</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E6ECE0',
    alignSelf: 'flex-start',
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  swatch: {
    width: 12,
    height: 4,
    borderRadius: 2,
  },
  label: {
    fontFamily: fonts.uiSemiBold,
    fontSize: 11,
    color: '#334155',
  },
});
