import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  ScrollView, StyleSheet, ActivityIndicator, SafeAreaView,
} from 'react-native';
import RouteCard from '../components/RouteCard';
import { findRoutes } from '../services/api';

export default function HomeScreen() {
  const [startLat, setStartLat] = useState('18.9220');
  const [startLon, setStartLon] = useState('72.8347');
  const [endLat,   setEndLat]   = useState('18.9350');
  const [endLon,   setEndLon]   = useState('72.8250');
  const [routes,   setRoutes]   = useState(null);
  const [conditions, setConditions] = useState(null);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState(null);

  async function handleFind() {
    setLoading(true);
    setError(null);
    setRoutes(null);
    try {
      const data = await findRoutes(
        parseFloat(startLat), parseFloat(startLon),
        parseFloat(endLat),   parseFloat(endLon),
      );
      setRoutes(data.routes);
      setConditions(data.conditions);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.container}>

        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.logo}>
            <Text style={styles.heat}>Heat</Text>
            <Text style={styles.cool}>Path</Text>
          </Text>
          <Text style={styles.tagline}>Most survivable route. Not fastest.</Text>
        </View>

        {/* Input form */}
        <View style={styles.form}>
          <Text style={styles.sectionLabel}>START POINT</Text>
          <View style={styles.row}>
            <TextInput
              style={[styles.input, styles.half]}
              value={startLat}
              onChangeText={setStartLat}
              placeholder="Latitude"
              placeholderTextColor="#8b8fa8"
              keyboardType="numeric"
            />
            <TextInput
              style={[styles.input, styles.half]}
              value={startLon}
              onChangeText={setStartLon}
              placeholder="Longitude"
              placeholderTextColor="#8b8fa8"
              keyboardType="numeric"
            />
          </View>

          <Text style={styles.sectionLabel}>END POINT</Text>
          <View style={styles.row}>
            <TextInput
              style={[styles.input, styles.half]}
              value={endLat}
              onChangeText={setEndLat}
              placeholder="Latitude"
              placeholderTextColor="#8b8fa8"
              keyboardType="numeric"
            />
            <TextInput
              style={[styles.input, styles.half]}
              value={endLon}
              onChangeText={setEndLon}
              placeholder="Longitude"
              placeholderTextColor="#8b8fa8"
              keyboardType="numeric"
            />
          </View>

          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleFind}
            disabled={loading}
          >
            {loading
              ? <ActivityIndicator color="#fff" />
              : <Text style={styles.buttonText}>Find Coolest Route</Text>
            }
          </TouchableOpacity>
        </View>

        {/* Error */}
        {error && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>⚠️ {error}</Text>
          </View>
        )}

        {/* Conditions bar */}
        {conditions && (
          <View style={styles.condBar}>
            <Text style={styles.condBarText}>
              🌡️ Heat index: {conditions.heat_index}°C
            </Text>
            <Text style={styles.condBarText}>
              💨 AQI: {Math.round(conditions.aqi_normalised * 300)}
            </Text>
          </View>
        )}

        {/* Route cards */}
        {routes && (
          <View style={styles.results}>
            <Text style={styles.resultsHeader}>
              {routes.length} routes compared
            </Text>
            {routes.map(route => (
              <RouteCard
                key={route.rank}
                route={route}
                rank={route.rank}
                conditions={conditions}
              />
            ))}
          </View>
        )}

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:       { flex: 1, backgroundColor: '#0f1117' },
  scroll:     { flex: 1 },
  container:  { padding: 20, paddingBottom: 40 },
  header:     { marginBottom: 24 },
  logo:       { fontSize: 32, fontWeight: '700', marginBottom: 4 },
  heat:       { color: '#ff6b35' },
  cool:       { color: '#38bdf8' },
  tagline:    { color: '#8b8fa8', fontSize: 14 },
  form:       { marginBottom: 20 },
  sectionLabel: {
    color: '#8b8fa8', fontSize: 11,
    fontWeight: '600', letterSpacing: 0.8,
    marginBottom: 6, marginTop: 12,
  },
  row:        { flexDirection: 'row', gap: 8 },
  input: {
    backgroundColor: '#1a1d27',
    borderWidth: 1, borderColor: '#2a2d3a',
    borderRadius: 10, padding: 12,
    color: '#e8e6f0', fontSize: 14, marginBottom: 8,
  },
  half:       { flex: 1 },
  button: {
    backgroundColor: '#38bdf8',
    borderRadius: 10, padding: 14,
    alignItems: 'center', marginTop: 8,
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: '#0f1117', fontWeight: '700', fontSize: 15 },
  errorBox: {
    backgroundColor: '#ef444418',
    borderRadius: 10, padding: 12,
    borderWidth: 1, borderColor: '#ef444444',
    marginBottom: 16,
  },
  errorText:  { color: '#ef4444', fontSize: 13 },
  condBar: {
    flexDirection: 'row', gap: 16,
    backgroundColor: '#1a1d27',
    borderRadius: 10, padding: 12,
    marginBottom: 16,
    borderWidth: 1, borderColor: '#2a2d3a',
  },
  condBarText: { color: '#8b8fa8', fontSize: 13 },
  results:    { marginTop: 4 },
  resultsHeader: {
    color: '#8b8fa8', fontSize: 12,
    marginBottom: 12, fontWeight: '500',
  },
});