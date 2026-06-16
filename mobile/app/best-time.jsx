import { View, Text } from 'react-native';
import { colors } from '../theme/colors';

export default function BestTime() {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background }}>
      <Text style={{ fontSize: 22, fontWeight: '700', color: colors.primary }}>Best Time to Walk</Text>
      <Text style={{ fontSize: 13, color: colors.textSecondary, marginTop: 8 }}>Coming soon</Text>
    </View>
  );
}
