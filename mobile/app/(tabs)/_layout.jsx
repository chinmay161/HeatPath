import { Tabs } from 'expo-router';
import { Text } from 'react-native';
import { colors } from '../../theme/colors';

function TabIcon({ emoji, focused }) {
  return (
    <Text style={{ fontSize: 20, opacity: focused ? 1 : 0.5 }}>{emoji}</Text>
  );
}

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textSecondary,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ focused }) => <TabIcon emoji="??" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="spots"
        options={{
          title: 'Spots',
          tabBarIcon: ({ focused }) => <TabIcon emoji="??" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="heatmap"
        options={{
          title: 'Heat Map',
          tabBarIcon: ({ focused }) => <TabIcon emoji="???" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="impact"
        options={{
          title: 'Impact',
          tabBarIcon: ({ focused }) => <TabIcon emoji="??" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ focused }) => <TabIcon emoji="??" focused={focused} />,
        }}
      />
    </Tabs>
  );
}
