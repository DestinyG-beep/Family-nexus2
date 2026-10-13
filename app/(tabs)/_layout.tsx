import { Tabs } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import type { ComponentProps } from 'react';

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: '#4f46e5',
        tabBarInactiveTintColor: '#64748b',
        tabBarStyle: {
          backgroundColor: '#ffffff',
          borderTopColor: '#e2e8f0',
          height: 68,
          paddingBottom: 10,
          paddingTop: 8,
        },
        tabBarIcon: ({ color, size }) => {
          const iconMap: Record<string, ComponentProps<typeof Feather>['name']> = {
            index: 'home',
            calendar: 'calendar',
            profile: 'user',
            settings: 'settings',
          };

          const icon = iconMap[route.name] ?? '•';
          return <Feather name={icon} size={size} color={color} />;
        },
      })}
    >
      <Tabs.Screen name="index" options={{ title: 'Home' }} />
      <Tabs.Screen name="media" options={{ href: null }} />
      <Tabs.Screen name="calendar" options={{ title: 'Calendar' }} />
      <Tabs.Screen name="profile" options={{ title: 'Profile' }} />
      <Tabs.Screen name="settings" options={{ title: 'Settings' }} />
    </Tabs>
  );
}
