// HeatPath design tokens — sourced from styles.css :root variables (exact hex values)

export const colors = {
  // Brand & cool
  forest: '#1C7C4A',
  forestDeep: '#0E4F2E',
  lime: '#A6DD3A',
  coolBlue: '#2563C9',

  // Heat severity
  safe: '#29A35A',
  caution: '#E5B23C',
  high: '#E8843A',
  extreme: '#C8322A',

  // Neutrals
  canvas: '#F4F6F1',
  sunken: '#EAF0E6',
  line: '#E6EBE1',
  muted: '#6B7A70',
  muted2: '#8A988E',
  ink: '#15241C',
  inkSoft: '#2C3B33',

  // Dark surfaces
  slate: '#0E1A16',
  slateCard: '#16241E',
  slateLine: '#22332B',
  slateText: '#E8F0EA',
  slateMuted: '#8DA396',
} as const;

export const radius = {
  sm: 12,
  md: 16,
  lg: 22,
  xl: 28,
} as const;

// Font family names as registered with expo-font
export const fonts = {
  display: 'BricolageGrotesque-Bold',
  displaySemiBold: 'BricolageGrotesque-SemiBold',
  ui: 'PlusJakartaSans-Regular',
  uiMedium: 'PlusJakartaSans-Medium',
  uiSemiBold: 'PlusJakartaSans-SemiBold',
  uiBold: 'PlusJakartaSans-Bold',
  data: 'SpaceGrotesk-Regular',
  dataSemiBold: 'SpaceGrotesk-SemiBold',
  dataBold: 'SpaceGrotesk-Bold',
} as const;

// Severity color map (lowercase keys, matching data.js)
export const severity: Record<string, string> = {
  safe: colors.safe,
  caution: colors.caution,
  high: colors.high,
  extreme: colors.extreme,
};
