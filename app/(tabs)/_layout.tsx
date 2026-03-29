import { Tabs } from 'expo-router';
import React from 'react';

import { HapticTab } from '@/components/haptic-tab';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors } from '@/constants/theme';
import { CoachProvider } from '@/context/coach-context';
import { ProfileProvider } from '@/context/profile-context';
import { ProgressProvider } from '@/context/progress-context';
import { useColorScheme } from '@/hooks/use-color-scheme';

export default function TabLayout() {
  const colorScheme = useColorScheme();

  return (
    <ProfileProvider>
      <ProgressProvider>
        <CoachProvider>
          <Tabs
            screenOptions={{
              tabBarActiveTintColor: Colors[colorScheme ?? 'light'].tint,
              headerShown: false,
              tabBarButton: HapticTab,
            }}>
            <Tabs.Screen
              name="index"
              options={{
                title: 'Profile',
                tabBarIcon: ({ color }) => <IconSymbol size={28} name="person.fill" color={color} />,
              }}
            />
            <Tabs.Screen
              name="analytics"
              options={{
                title: 'Analytics',
                tabBarIcon: ({ color }) => <IconSymbol size={28} name="chart.bar.fill" color={color} />,
              }}
            />
            <Tabs.Screen
              name="progress"
              options={{
                title: 'Progress',
                tabBarIcon: ({ color }) => <IconSymbol size={28} name="chart.line.uptrend.xyaxis" color={color} />,
              }}
            />
            <Tabs.Screen
              name="explore"
              options={{
                title: 'About',
                tabBarIcon: ({ color }) => <IconSymbol size={28} name="info.circle.fill" color={color} />,
              }}
            />
          </Tabs>
        </CoachProvider>
      </ProgressProvider>
    </ProfileProvider>
  );
}
