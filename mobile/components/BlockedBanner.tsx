import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { fonts } from '../theme/colors';

type Props = {
  dark?: boolean;
  message?: string;
};

export function BlockedBanner({
  dark = false,
  message = 'Live data coming soon — endpoint not yet available',
}: Props) {
  return (
    <View style={[styles.banner, dark ? styles.dark : styles.light]}>
      <View style={[styles.dot, { backgroundColor: dark ? '#8DA396' : '#6B7A70' }]} />
      <Text style={[styles.text, { color: dark ? '#8DA396' : '#6B7A70' }]}>{message}</Text>
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
    backgroundColor: '#F4F6F1',
    borderColor: '#E6EBE1',
  },
  dark: {
    backgroundColor: '#16241E',
    borderColor: '#22332B',
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
