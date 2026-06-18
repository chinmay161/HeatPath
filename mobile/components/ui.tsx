import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ViewStyle,
  TextStyle,
} from 'react-native';
import Icon from './Icon';
import { colors, fonts, radius, severity } from '../theme/colors';
import type { Route } from '../data/mockData';

// ─── SeverityTag ──────────────────────────────────────────────────────────────
const SEV_BG: Record<string, string> = {
  SAFE: colors.safe,
  CAUTION: colors.caution,
  HIGH: colors.high,
  EXTREME: colors.extreme,
};
const SEV_TEXT: Record<string, string> = {
  SAFE: '#fff',
  CAUTION: '#3d2c00',
  HIGH: '#fff',
  EXTREME: '#fff',
};

interface SeverityTagProps {
  level: 'SAFE' | 'CAUTION' | 'HIGH' | 'EXTREME';
}

export function SeverityTag({ level }: SeverityTagProps) {
  return (
    <View style={[styles.sev, { backgroundColor: SEV_BG[level] || colors.muted }]}>
      <Text style={[styles.sevText, { color: SEV_TEXT[level] || '#fff' }]}>{level}</Text>
    </View>
  );
}

// ─── Pill ─────────────────────────────────────────────────────────────────────
const PILL_STYLES: Record<string, { bg: string; fg: string }> = {
  warm: { bg: '#FCEEDD', fg: '#b5560f' },
  green: { bg: '#E6F4E2', fg: '#16633B' },
  blue: { bg: '#E1ECFB', fg: '#1a4ea0' },
};

interface PillProps {
  tone?: 'warm' | 'green' | 'blue';
  icon?: string;
  children: React.ReactNode;
}

export function Pill({ tone = 'green', icon, children }: PillProps) {
  const { bg, fg } = PILL_STYLES[tone] || PILL_STYLES.green;
  return (
    <View style={[styles.pill, { backgroundColor: bg }]}>
      {icon && <Icon name={icon} size={15} stroke={fg} />}
      <Text style={[styles.pillText, { color: fg }]}>{children}</Text>
    </View>
  );
}

// ─── IconChip ─────────────────────────────────────────────────────────────────
interface IconChipProps {
  name: string;
  bg: string;
  color: string;
  size?: number;
  radius?: number;
  iconSize?: number;
}

export function IconChip({ name, bg, color, size = 44, radius: r = 13, iconSize }: IconChipProps) {
  return (
    <View style={[styles.iconChip, { width: size, height: size, backgroundColor: bg, borderRadius: r }]}>
      <Icon name={name} size={iconSize || Math.round(size * 0.5)} stroke={color} />
    </View>
  );
}

// ─── Timeline (shade/sun exposure bar) ────────────────────────────────────────
const SEG_COLOR: Record<string, string> = {
  shade: '#1C7C4A',
  sun: '#E8843A',
  safe: colors.safe,
  caution: colors.caution,
  high: colors.high,
  extreme: colors.extreme,
};

interface TimelineProps {
  segments: [number, string][];
  small?: boolean;
}

export function Timeline({ segments, small }: TimelineProps) {
  return (
    <View style={[styles.timeline, small && styles.timelineSm]}>
      {segments.map(([flex, sev], i) => (
        <View key={i} style={{ flex, backgroundColor: SEG_COLOR[sev] || sev, borderRadius: 100 }} />
      ))}
    </View>
  );
}

// ─── Button ───────────────────────────────────────────────────────────────────
interface ButtonProps {
  variant?: 'lime' | 'ghost' | '';
  block?: boolean;
  children: React.ReactNode;
  onPress?: () => void;
  style?: ViewStyle;
  textStyle?: TextStyle;
}

export function Button({ variant = '', block, children, onPress, style, textStyle }: ButtonProps) {
  let containerStyle: any = [styles.btn];
  let txtStyle: any = [styles.btnText];

  if (variant === 'lime') {
    containerStyle.push(styles.btnLime);
    txtStyle.push({ color: '#1f3d12' });
  } else if (variant === 'ghost') {
    containerStyle.push(styles.btnGhost);
    txtStyle.push({ color: '#16633B' });
  }
  if (block) containerStyle.push({ width: '100%' });
  if (style) containerStyle.push(style);
  if (textStyle) txtStyle.push(textStyle);

  return (
    <TouchableOpacity onPress={onPress} style={containerStyle} activeOpacity={0.85}>
      <Text style={txtStyle}>{children}</Text>
    </TouchableOpacity>
  );
}

// ─── RouteCard ────────────────────────────────────────────────────────────────
interface RouteCardProps {
  route: Route;
  active: boolean;
  onPress: () => void;
}

export function RouteCard({ route, active, onPress }: RouteCardProps) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.8}
      style={[styles.routeCard, active && styles.routeCardActive]}
    >
      {/* Header */}
      <View style={styles.routeCardHead}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 9 }}>
          <IconChip name={route.icon} bg={route.iconBg} color={route.iconColor} size={34} radius={11} iconSize={19} />
          <View>
            <Text style={styles.routeTitle}>{route.title}</Text>
            <Text style={styles.routeSub}>{route.sub}</Text>
          </View>
        </View>
        <SeverityTag level={route.severity} />
      </View>

      {/* Stats row */}
      <View style={styles.routeStats}>
        <StatCell value={route.min} label="walk time" color="#102b1e" />
        <StatCell value={route.feels} label="feels-like" color={route.feelsColor} />
        <StatCell value={route.shade} label="in shade" color={colors.forest} />
      </View>

      {/* Exposure bar */}
      <Timeline segments={route.bar} small />
    </TouchableOpacity>
  );
}

function StatCell({ value, label, color }: { value: string; label: string; color: string }) {
  return (
    <View>
      <Text style={[styles.statBig, { color }]}>{value}</Text>
      <Text style={styles.statSmall}>{label}</Text>
    </View>
  );
}

// ─── BestTimeChart ────────────────────────────────────────────────────────────
interface BestTimeBar {
  h: string;
  v: number;
  sev: string;
  best?: boolean;
}

interface BestTimeChartProps {
  bars: readonly BestTimeBar[];
}

export function BestTimeChart({ bars }: BestTimeChartProps) {
  return (
    <View style={styles.chart}>
      {bars.map((b) => (
        <View key={b.h} style={styles.chartCol}>
          <View
            style={{
              width: '100%',
              height: `${b.v}%` as any,
              backgroundColor: severity[b.sev] || colors.muted,
              borderRadius: 6,
            }}
          />
          <Text style={[styles.chartLabel, b.best && { color: colors.lime }]}>{b.h}</Text>
        </View>
      ))}
    </View>
  );
}

// ─── Logo ─────────────────────────────────────────────────────────────────────
import Svg, { Path } from 'react-native-svg';

export function Logo({ size = 32 }: { size?: number }) {
  const s = size;
  const inner = Math.round(s * 0.56);
  return (
    <View
      style={{
        width: s, height: s, borderRadius: 9,
        backgroundColor: colors.forestDeep,
        alignItems: 'center', justifyContent: 'center',
      }}
    >
      <Svg width={inner} height={inner} viewBox="0 0 24 24" fill="none" stroke={colors.lime} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
        <Path d="M12 2v8M12 22v-4M5 10c0 4 3 6 7 6s7-2 7-6c0-3-2-5-2-5s-2 2-5 2-5-2-7 3z" />
      </Svg>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  sev: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  sevText: {
    fontFamily: fonts.dataBold,
    fontSize: 11,
    letterSpacing: 0.5,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 13,
    paddingVertical: 9,
    borderRadius: 100,
  },
  pillText: {
    fontFamily: fonts.uiBold,
    fontSize: 13,
  },
  iconChip: {
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  timeline: {
    flexDirection: 'row',
    height: 13,
    borderRadius: 100,
    overflow: 'hidden',
    gap: 2,
    marginTop: 12,
  },
  timelineSm: {
    height: 11,
  },
  btn: {
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 22,
    backgroundColor: colors.forest,
    alignItems: 'center',
    justifyContent: 'center',
    // shadows
    ...(require('react-native').Platform.OS === 'web'
      ? { boxShadow: '0 12px 24px -12px rgba(28,124,74,0.7)' }
      : {
          shadowColor: '#1C7C4A',
          shadowOffset: { width: 0, height: 6 },
          shadowOpacity: 0.4,
          shadowRadius: 12,
          elevation: 6,
        }),
  } as any,
  btnText: {
    fontFamily: fonts.uiBold,
    fontSize: 15,
    color: '#fff',
  },
  btnLime: {
    backgroundColor: colors.lime,
  },
  btnGhost: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#D5DFCE',
  },
  routeCard: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 18,
    padding: 16,
  },
  routeCardActive: {
    borderWidth: 1.5,
    borderColor: colors.forest,
    backgroundColor: '#F6FBF2',
    ...(require('react-native').Platform.OS === 'web'
      ? { boxShadow: '0 14px 28px -22px rgba(28,124,74,0.5)' }
      : {
          shadowColor: '#1C7C4A',
          shadowOffset: { width: 0, height: 7 },
          shadowOpacity: 0.25,
          shadowRadius: 14,
          elevation: 4,
        }),
  } as any,
  routeCardHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  routeTitle: {
    fontFamily: fonts.display,
    fontSize: 16,
    color: '#102b1e',
  },
  routeSub: {
    fontFamily: fonts.ui,
    fontSize: 11,
    color: colors.muted,
  },
  routeStats: {
    flexDirection: 'row',
    gap: 20,
    marginTop: 13,
  },
  statBig: {
    fontFamily: fonts.dataBold,
    fontSize: 24,
  },
  statSmall: {
    fontFamily: fonts.ui,
    fontSize: 11,
    color: colors.muted2,
  },
  chart: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 7,
    flex: 1,
    minHeight: 120,
  },
  chartCol: {
    flex: 1,
    alignItems: 'center',
    gap: 6,
    height: '100%',
    justifyContent: 'flex-end',
  },
  chartLabel: {
    fontFamily: fonts.dataSemiBold,
    fontSize: 11,
    color: '#9fb7a6',
  },
});
