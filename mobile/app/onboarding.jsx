import { View, Text, TouchableOpacity, Image, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Svg, { Defs, RadialGradient, Stop, Rect } from 'react-native-svg';
import { TreeDeciduous, Droplet, Heart } from 'lucide-react-native';
import { colors } from '../theme/colors';
import { shadows, spacing, EXTRA_TOP_PADDING } from '../theme/styles';

const FEATURES = [
  { Icon: TreeDeciduous, text: 'Routes ranked by shade, not just speed', bg: 'rgba(34,197,94,0.25)', color: '#86EFAC' },
  { Icon: Droplet, text: 'Water stops & cool refuges on the way', bg: 'rgba(59,130,246,0.25)', color: '#93C5FD' },
  { Icon: Heart, text: 'Tuned for who you are walking with', bg: 'rgba(244,114,182,0.25)', color: '#F9A8D4' },
];

// Above this window width we switch from the stacked mobile composition to a
// side-by-side hero layout - otherwise the screen just stretches into a
// narrow column of text floating in a sea of green.
const WIDE_BREAKPOINT = 760;

// Soft radial sun-glow, rendered with an svg gradient so it actually fades
// out instead of ending in a hard circle edge like a flat tinted View does.
// The absolute positioning lives on a plain RN View wrapper rather than on
// the Svg itself - letting an svg's own intrinsic width/height drive
// position/flex sizing is unreliable on web and was blowing out the layout.
function SunGlow({ size, style }) {
  return (
    <View style={[{ position: 'absolute', width: size, height: size }, style]} pointerEvents="none">
      <Svg width={size} height={size}>
        <Defs>
          <RadialGradient id="onboardingGlow" cx="50%" cy="50%" r="50%">
            <Stop offset="0%" stopColor="#FDE68A" stopOpacity="0.7" />
            <Stop offset="45%" stopColor="#FBBF24" stopOpacity="0.32" />
            <Stop offset="100%" stopColor="#FBBF24" stopOpacity="0" />
          </RadialGradient>
        </Defs>
        <Rect width={size} height={size} fill="url(#onboardingGlow)" />
      </Svg>
    </View>
  );
}

export default function Onboarding() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const isWide = width >= WIDE_BREAKPOINT;

  const handleGetStarted = async () => {
    await AsyncStorage.setItem('hasOnboarded', 'true');
    router.replace('/(tabs)');
  };

  const handleSetupProfile = async () => {
    await AsyncStorage.setItem('hasOnboarded', 'true');
    router.replace('/(tabs)/profile');
  };

  const mascotWidth = isWide ? 240 : 108;

  const mascot = (
    <Image
      source={require('../assets/mascot/mascot.gif')}
      style={{ width: mascotWidth, height: mascotWidth * 1.78, resizeMode: 'contain' }}
    />
  );

  const headline = (
    <Text style={{
      fontSize: isWide ? 44 : 36, fontWeight: 'bold', color: '#FFFFFF',
      lineHeight: isWide ? 50 : 42,
    }}>
      Walk the{'\n'}cool way.
    </Text>
  );

  const paragraph = (
    <Text style={{ fontSize: 16, color: 'rgba(255,255,255,0.85)', marginTop: 16, lineHeight: 24 }}>
      Heat-aware navigation for Indian cities. Avoid the sun, follow the
      shade, and arrive safe - even on the hottest days.
    </Text>
  );

  const features = (
    <View style={{ marginTop: 28, gap: 18 }}>
      {FEATURES.map(function (f, i) {
        const Icon = f.Icon;
        return (
          <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
            <View style={{
              width: 36, height: 36, borderRadius: 12,
              backgroundColor: f.bg, alignItems: 'center', justifyContent: 'center',
            }}>
              <Icon size={18} color={f.color} />
            </View>
            <Text style={{ fontSize: 14, color: '#FFFFFF', flex: 1 }}>{f.text}</Text>
          </View>
        );
      })}
    </View>
  );

  const buttons = (
    <View style={{ gap: 12 }}>
      <TouchableOpacity
        onPress={handleGetStarted}
        style={{ backgroundColor: '#FFFFFF', borderRadius: 16, paddingVertical: 16, alignItems: 'center', ...shadows.md }}
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
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.primaryDark, overflow: 'hidden' }}>
      {/* Dramatic sun-glow bleeding off the top-right corner - the poster moment. */}
      <SunGlow
        size={isWide ? 980 : 420}
        style={{ top: isWide ? -340 : -140, right: isWide ? -340 : -140 }}
      />
      {/* Faint lime echo bottom-left for depth, kept subtle so it doesn't compete. */}
      <View style={{
        position: 'absolute', bottom: -90, left: -90,
        width: 240, height: 240, borderRadius: 120,
        backgroundColor: 'rgba(163,230,53,0.08)',
      }} />

      {isWide ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xxl }}>
          <View style={{
            flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
            gap: 72, width: '100%', maxWidth: 1000,
          }}>
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
              {mascot}
            </View>
            <View style={{ width: 440 }}>
              {headline}
              {paragraph}
              {features}
              <View style={{ marginTop: 40 }}>{buttons}</View>
            </View>
          </View>
        </View>
      ) : (
        <View style={{
          flex: 1, width: '100%', maxWidth: 480, alignSelf: 'center',
          paddingHorizontal: spacing.xl,
          paddingTop: insets.top + EXTRA_TOP_PADDING + 36,
          paddingBottom: spacing.xl,
          justifyContent: 'space-between',
        }}>
          <View>
            <View style={{ alignSelf: 'flex-start', marginBottom: 20, ...shadows.sm }}>{mascot}</View>
            {headline}
            {paragraph}
            {features}
          </View>

          {buttons}
        </View>
      )}
    </View>
  );
}
