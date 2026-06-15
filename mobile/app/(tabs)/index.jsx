import { View, Text } from 'react-native';
import { colors } from '../../theme/colors';

export default function Home() {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background }}>
      <Text style={{ fontSize: 24, fontWeight: 'bold', color: colors.primary }}>Home</Text>
    </View>
  );
}
