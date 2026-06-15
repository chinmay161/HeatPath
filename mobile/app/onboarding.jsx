import { View, Text, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors } from '../theme/colors';

const FEATURES = [
  { emoji: '??', text: 'Routes ranked by shade, not just speed' },
  { emoji: '??', text: 'Water stops & cool refuges on the way' },
  { emoji: '??', text: 'Tuned for who you are walking with' },
];

export default function Onboarding() {
  const router = useRouter();

  const handleGetStarted = async () => {
    await AsyncStorage.setItem('hasOnboarded', 'true');
    router.replace('/(tabs)');
  };

  const handleSetupProfile = async () => {
    await AsyncStorage.setItem('hasOnboarded', 'true');
    router.replace('/(tabs)/profile');
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.primaryDark, padding: 24, justifyContent: 'space-between' }}>
      <View style={{ marginTop: 60 }}>
        <View style={{
          width: 64, height: 64, borderRadius: 32,
          backgroundColor: 'rgba(255,255,255,0.15)',
          alignItems: 'center', justifyContent: 'center', marginBottom: 32,
        }}>
          <Text style={{ fontSize: 32 }}>??</Text>
        </View>

        <Text style={{ fontSize: 36, fontWeight: 'bold', color: '#FFFFFF', lineHeight: 44 }}>
          Walk the{'\n'}cool way.
        </Text>
        <Text style={{ fontSize: 16, color: 'rgba(255,255,255,0.85)', marginTop: 16, lineHeight: 24 }}>
          Heat-aware navigation for Indian cities. Avoid the sun, follow the
          shade, and arrive safe - even on the hottest days.
        </Text>

        <View style={{ marginTop: 32, gap: 16 }}>
          {FEATURES.map((f, i) => (
            <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <Text style={{ fontSize: 20 }}>{f.emoji}</Text>
              <Text style={{ fontSize: 14, color: '#FFFFFF', flex: 1 }}>{f.text}</Text>
            </View>
          ))}
        </View>
      </View>

      <View style={{ gap: 12, marginBottom: 24 }}>
        <TouchableOpacity
          onPress={handleGetStarted}
          style={{ backgroundColor: '#FFFFFF', borderRadius: 16, paddingVertical: 16, alignItems: 'center' }}
        >
          <Text style={{ fontSize: 16, fontWeight: 'bold', color: colors.primaryDark }}>Get started</Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={handleSetupProfile}
          style={{
            borderRadius: 16, paddingVertical: 16, alignItems: 'center',
            borderWidth: 1, borderColor: 'rgba(255,255,255,0.4)',
          }}
        >
          <Text style={{ fontSize: 16, fontWeight: 'bold', color: '#FFFFFF' }}>Set up my heat profile</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
