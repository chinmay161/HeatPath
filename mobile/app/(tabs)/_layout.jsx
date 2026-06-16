import { Tabs } from 'expo-router';
import { Home, MapPin, Map, BarChart3, User } from 'lucide-react-native';
import { colors } from '../../theme/colors';

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
          tabBarIcon: function (props) {
            return <Home size={22} color={props.color} />;
          },
        }}
      />
      <Tabs.Screen
        name="spots"
        options={{
          title: 'Spots',
          tabBarIcon: function (props) {
            return <MapPin size={22} color={props.color} />;
          },
        }}
      />
      <Tabs.Screen
        name="heatmap"
        options={{
          title: 'Heat Map',
          tabBarIcon: function (props) {
            return <Map size={22} color={props.color} />;
          },
        }}
      />
      <Tabs.Screen
        name="impact"
        options={{
          title: 'Impact',
          tabBarIcon: function (props) {
            return <BarChart3 size={22} color={props.color} />;
          },
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: function (props) {
            return <User size={22} color={props.color} />;
          },
        }}
      />
    </Tabs>
  );
}
