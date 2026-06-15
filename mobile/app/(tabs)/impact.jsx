import { View, Text } from 'react-native';
import { colors } from '../../theme/colors';

export default function Impact() {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.darkBackground }}>
      <Text style={{ fontSize: 24, fontWeight: 'bold', color: colors.darkTextPrimary }}>Impact</Text>
    </View>
  );
}
