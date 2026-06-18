import { Tabs, usePathname, useRouter } from 'expo-router';
import { View } from 'react-native';
import { useResponsiveLayout } from '../../hooks/useResponsiveLayout';
import { AppSidebar } from '../../components/Sidebar';
import { AppTabBar } from '../../components/TabBar';

const TAB_ROUTES: Record<string, string> = {
  home: '/(tabs)/',
  routes: '/(tabs)/routes',
  map: '/(tabs)/map',
  impact: '/(tabs)/impact',
  profile: '/(tabs)/profile',
};

function pathnameToTab(pathname: string): string {
  if (pathname === '/' || pathname === '/(tabs)' || pathname === '/(tabs)/' || pathname === '') return 'home';
  if (pathname.includes('/routes')) return 'routes';
  if (pathname.includes('/map')) return 'map';
  if (pathname.includes('/impact')) return 'impact';
  if (pathname.includes('/profile')) return 'profile';
  // Searching, destination, and coolspots are sub-flows of home
  if (pathname.includes('/searching') || pathname.includes('/coolspots') || pathname.includes('/destination')) return 'home';
  return 'home';
}

export default function TabsLayout() {
  const { isDesktop } = useResponsiveLayout();
  const pathname = usePathname();
  const router = useRouter();
  const activeTab = pathnameToTab(pathname);

  const handleNav = (key: string) => {
    const path = TAB_ROUTES[key];
    if (path) router.navigate(path as any);
  };

  const tabsElement = (
    <Tabs
      screenOptions={{ headerShown: false }}
      tabBar={(props) =>
        isDesktop ? null : <AppTabBar {...props} active={activeTab} onNav={handleNav} />
      }
    >
      <Tabs.Screen name="index" options={{ title: 'Home' }} />
      <Tabs.Screen name="routes" options={{ title: 'Routes' }} />
      <Tabs.Screen name="map" options={{ title: 'Map' }} />
      <Tabs.Screen name="impact" options={{ title: 'Impact' }} />
      <Tabs.Screen name="profile" options={{ title: 'Profile' }} />
      {/* Sub-flows — navigable but not visible as tabs */}
      <Tabs.Screen name="searching"   options={{ title: 'Searching',   href: null } as any} />
      <Tabs.Screen name="coolspots"   options={{ title: 'Cool Spots',  href: null } as any} />
      <Tabs.Screen name="destination" options={{ title: 'Destination', href: null } as any} />
    </Tabs>
  );

  if (isDesktop) {
    return (
      <View style={{ flex: 1, flexDirection: 'row' }}>
        <AppSidebar active={activeTab} onNav={handleNav} />
        <View style={{ flex: 1 }}>{tabsElement}</View>
      </View>
    );
  }

  return tabsElement;
}
