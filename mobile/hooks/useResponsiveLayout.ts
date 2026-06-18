import { useWindowDimensions } from 'react-native';

const DESKTOP_BREAKPOINT = 768;

export type LayoutMode = 'mobile' | 'desktop';

export function useResponsiveLayout(): { layout: LayoutMode; isDesktop: boolean; isMobile: boolean } {
  const { width } = useWindowDimensions();
  const isDesktop = width >= DESKTOP_BREAKPOINT;
  return {
    layout: isDesktop ? 'desktop' : 'mobile',
    isDesktop,
    isMobile: !isDesktop,
  };
}
