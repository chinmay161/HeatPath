import React from 'react';
import { View, Text, Image } from 'react-native';
import { colors } from '../theme/colors';
import { spacing } from '../theme/styles';

export default function MascotLoader(props) {
  const message = props.message || 'Loading...';
  const size = props.size || 100;

  return (
    <View style={{ alignItems: 'center', justifyContent: 'center', padding: spacing.xl }}>
      <Image
        source={require('../assets/mascot/mascot.gif')}
        style={{ width: size, height: size * 1.78, resizeMode: 'contain' }}
      />
      <Text style={{ fontSize: 13, color: colors.textSecondary, marginTop: spacing.md, textAlign: 'center' }}>
        {message}
      </Text>
    </View>
  );
}
