import { View, Text, ActivityIndicator, ScrollView } from 'react-native';
import { useCurrentConditions } from '../../hooks/useCurrentConditions';
import { getThermalStress } from '../../utils/thermalStress';
import { colors } from '../../theme/colors';
import SearchCard from '../../components/SearchCard';
import ExploreGrid from '../../components/ExploreGrid';

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

export default function Home() {
  const conditionsData = useCurrentConditions();
  const location = conditionsData.location;
  const conditions = conditionsData.conditions;
  const loading = conditionsData.loading;
  const error = conditionsData.error;

  const heatIndex = conditions ? conditions.heat_index : null;
  const aqi = conditions ? conditions.aqi_index : null;
  const stress = heatIndex != null ? getThermalStress(heatIndex) : null;
  const isHeatwave = heatIndex != null && heatIndex >= 39;
  const isHotStress = stress && (stress.label === 'High' || stress.label === 'Extreme');

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={{ paddingHorizontal: 20, paddingTop: 60, paddingBottom: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <View>
          <Text style={{ fontSize: 13, color: colors.textSecondary, fontWeight: '600', letterSpacing: 0.5 }}>
            {getGreeting().toUpperCase()}
          </Text>
          <Text style={{ fontSize: 18, fontWeight: '700', color: colors.textPrimary, marginTop: 2 }}>
            {loading ? 'Finding you...' : (location && location.label) || 'Your area'}
          </Text>
        </View>
        <View style={{
          width: 36, height: 36, borderRadius: 18,
          backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center',
          borderWidth: 1, borderColor: colors.border,
        }}>
          <Text style={{ fontSize: 18 }}>FOX</Text>
        </View>
      </View>

      <View style={{ paddingHorizontal: 20 }}>
        {loading ? (
          <View style={{
            borderRadius: 20, padding: 24, backgroundColor: colors.surface,
            alignItems: 'center', justifyContent: 'center', minHeight: 140,
            borderWidth: 1, borderColor: colors.border,
          }}>
            <ActivityIndicator color={colors.primary} />
          </View>
        ) : error || heatIndex == null ? (
          <View style={{
            borderRadius: 20, padding: 20, backgroundColor: colors.surface,
            borderWidth: 1, borderColor: colors.border,
          }}>
            <Text style={{ color: colors.textSecondary }}>
              Could not get current conditions. Allow location access and try again.
            </Text>
          </View>
        ) : (
          <View style={{
            borderRadius: 20, padding: 20,
            backgroundColor: isHotStress ? '#F97316' : colors.primary,
          }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <View>
                <Text style={{ fontSize: 11, fontWeight: '700', color: 'rgba(255,255,255,0.8)', letterSpacing: 1 }}>
                  FEELS LIKE
                </Text>
                <Text style={{ fontSize: 48, fontWeight: '800', color: '#FFFFFF', marginTop: 2 }}>
                  {Math.round(heatIndex)} deg
                </Text>
                <Text style={{ fontSize: 13, color: 'rgba(255,255,255,0.85)', marginTop: 4 }}>
                  Air quality index {aqi != null ? Math.round(aqi * 100) : '--'}
                </Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <View style={{
                  backgroundColor: 'rgba(255,255,255,0.25)', borderRadius: 12,
                  paddingHorizontal: 10, paddingVertical: 4, marginBottom: 8,
                }}>
                  <Text style={{ fontSize: 11, fontWeight: '700', color: '#FFFFFF' }}>
                    {stress.label.toUpperCase()} STRESS
                  </Text>
                </View>
                <Text style={{ fontSize: 32 }}>SUN</Text>
              </View>
            </View>

            {isHeatwave && (
              <View style={{
                backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 12,
                padding: 10, marginTop: 14, flexDirection: 'row', alignItems: 'center', gap: 8,
              }}>
                <Text style={{ fontSize: 16 }}>!</Text>
                <Text style={{ fontSize: 12, color: '#FFFFFF', flex: 1, lineHeight: 17 }}>
                  Heatwave conditions. Walk before 9 AM or after 6 PM where you can.
                </Text>
              </View>
            )}
          </View>
        )}

        <View style={{ marginTop: 16 }}>
          <SearchCard currentLocation={location} />
        </View>

        <View style={{ marginTop: 20, marginBottom: 32 }}>
          <ExploreGrid />
        </View>
      </View>
    </ScrollView>
  );
}