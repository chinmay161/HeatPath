import { Platform } from 'react-native';

const webShadow = function (str) {
  return Platform.OS === 'web' ? { boxShadow: str } : {};
};

export const shadows = {
  sm: {
    ...webShadow('0px 2px 8px rgba(15, 23, 42, 0.12)'),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 3,
  },
  md: {
    ...webShadow('0px 6px 16px rgba(15, 23, 42, 0.16)'),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.16,
    shadowRadius: 14,
    elevation: 6,
  },
  lg: {
    ...webShadow('0px 14px 32px rgba(15, 23, 42, 0.20)'),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.20,
    shadowRadius: 24,
    elevation: 10,
  },
};

export const radii = {
  sm: 12,
  md: 16,
  lg: 20,
  xl: 24,
  pill: 999,
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
};

// Extra breathing room added on top of the device's actual safe-area inset.
// Use as: paddingTop: insets.top + EXTRA_TOP_PADDING
export const EXTRA_TOP_PADDING = 12;