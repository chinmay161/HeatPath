import { View, Text, StyleSheet } from 'react-native';

export default function RouteCard({ route, rank, conditions }) {
  const isTop = rank === 1;

  const overallPct    = Math.round(route.overall_score    * 100);
  const shadePct      = Math.round(route.shade_safety_score * 100);
  const heatPct       = Math.round(route.heat_safety_score  * 100);

  const scoreColor =
    overallPct >= 60 ? '#22c55e' :
    overallPct >= 35 ? '#f59e0b' : '#ef4444';

  return (
    <View style={[styles.card, isTop && styles.topCard]}>
      {isTop && (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>❄️ HEATPATH BEST</Text>
        </View>
      )}

      <View style={styles.header}>
        <Text style={styles.rank}>Route {rank}</Text>
        <Text style={[styles.score, { color: scoreColor }]}>
          {overallPct}
          <Text style={styles.scoreLabel}>/100</Text>
        </Text>
      </View>

      <View style={styles.stats}>
        <Stat label="Heat safety"  value={`${heatPct}%`}  color="#ff6b35" />
        <Stat label="Shade cover"  value={`${shadePct}%`} color="#38bdf8" />
        <Stat label="Segments"     value={route.segment_count} color="#a78bfa" />
      </View>

      {conditions && (
        <View style={styles.conditions}>
          <Text style={styles.condText}>
            🌡️ Feels like {conditions.heat_index}°C
          </Text>
          <Text style={styles.condText}>
            💨 AQI {Math.round(conditions.aqi_normalised * 300)}
          </Text>
        </View>
      )}

      <View style={styles.footer}>
        <Text style={styles.footerText}>
          {route.segment_count} waypoints · comfort score {route.overall_score.toFixed(3)}
        </Text>
      </View>
    </View>
  );
}

function Stat({ label, value, color }) {
  return (
    <View style={styles.stat}>
      <Text style={[styles.statVal, { color }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#1a1d27',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#2a2d3a',
  },
  topCard: {
    borderColor: '#38bdf8',
    borderWidth: 2,
  },
  badge: {
    backgroundColor: '#38bdf822',
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
    alignSelf: 'flex-start',
    marginBottom: 10,
  },
  badgeText: {
    color: '#38bdf8',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  rank: {
    color: '#e8e6f0',
    fontSize: 16,
    fontWeight: '600',
  },
  score: {
    fontSize: 28,
    fontWeight: '700',
  },
  scoreLabel: {
    fontSize: 14,
    color: '#8b8fa8',
    fontWeight: '400',
  },
  stats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  stat: {
    alignItems: 'center',
    flex: 1,
  },
  statVal: {
    fontSize: 18,
    fontWeight: '600',
  },
  statLabel: {
    color: '#8b8fa8',
    fontSize: 11,
    marginTop: 2,
  },
  conditions: {
    flexDirection: 'row',
    gap: 12,
    backgroundColor: '#0f1117',
    borderRadius: 8,
    padding: 10,
    marginBottom: 10,
  },
  condText: {
    color: '#8b8fa8',
    fontSize: 12,
  },
  footer: {
    borderTopWidth: 1,
    borderTopColor: '#2a2d3a',
    paddingTop: 8,
  },
  footerText: {
    color: '#8b8fa8',
    fontSize: 11,
  },
});