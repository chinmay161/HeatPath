import { View, Text, ScrollView } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { colors } from '../theme/colors';

export default function Results() {
  const params = useLocalSearchParams();

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={{ paddingHorizontal: 20, paddingTop: 60, paddingBottom: 16 }}>
        <Text style={{ fontSize: 22, fontWeight: '800', color: colors.textPrimary, marginBottom: 8 }}>
          Route Results
        </Text>
        <Text style={{ fontSize: 13, color: colors.textSecondary }}>
          {params.startLabel} to {params.endLabel}
        </Text>

        <View style={{
          marginTop: 20, padding: 16, borderRadius: 16,
          backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
        }}>
          <Text style={{ fontSize: 13, color: colors.textSecondary, lineHeight: 19 }}>
            Placeholder screen. Real route cards + map view coming soon.
          </Text>
        </View>
      </View>
    </ScrollView>
  );
}
