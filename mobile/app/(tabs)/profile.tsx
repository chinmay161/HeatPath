import { View, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, fonts } from '../../theme/colors';

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  return (
    <View style={{ flex: 1, backgroundColor: colors.canvas, paddingTop: insets.top, justifyContent: 'center', alignItems: 'center' }}>
      <Text style={{ fontFamily: fonts.display, fontSize: 24, color: colors.ink }}>Profile</Text>
      <Text style={{ fontFamily: fonts.ui, color: colors.muted, marginTop: 8 }}>Building...</Text>
    </View>
  );
}
