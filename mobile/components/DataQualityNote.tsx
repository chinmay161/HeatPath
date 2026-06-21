import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { fonts } from '../theme/colors';

type Props = {
  dark?: boolean;
};

export function DataQualityNote({ dark = false }: Props) {
  return (
    <View style={[styles.banner, dark ? styles.dark : styles.light]}>
      <View style={[styles.dot, { backgroundColor: dark ? '#C4944A' : '#A07830' }]} />
      <Text style={[styles.text, { color: dark ? '#C4944A' : '#A07830' }]}>
        Some shade estimates here use road type, not local coverage
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
  },
  light: {
    backgroundColor: '#FBF6EE',
    borderColor: '#EEE0C0',
  },
  dark: {
    backgroundColor: '#1C1810',
    borderColor: '#2E2412',
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    flexShrink: 0,
    opacity: 0.7,
  },
  text: {
    fontFamily: fonts.uiSemiBold,
    fontSize: 12,
    flex: 1,
  },
});
