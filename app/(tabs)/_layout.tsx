import { Tabs } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: false,
        tabBarStyle: {
          backgroundColor: '#0D0D0D',
          borderTopColor: '#1E1E1E',
          borderTopWidth: 1,
          height: 60,
          paddingBottom: 8,
        },
      }}
    >
      <Tabs.Screen
        name="leaderboard"
        options={{
          tabBarIcon: ({ focused }) => (
            <Ionicons name={focused ? 'trophy' : 'trophy-outline'} size={24} color="#FFFFFF" style={{ opacity: focused ? 1 : 0.35 }} />
          ),
        }}
      />
      <Tabs.Screen
        name="index"
        options={{
          tabBarIcon: ({ focused }) => (
            <Ionicons name={focused ? 'map' : 'map-outline'} size={24} color="#FFFFFF" style={{ opacity: focused ? 1 : 0.35 }} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          tabBarIcon: ({ focused }) => (
            <Ionicons name={focused ? 'person' : 'person-outline'} size={24} color="#FFFFFF" style={{ opacity: focused ? 1 : 0.35 }} />
          ),
        }}
      />
      <Tabs.Screen name="map" options={{ href: null }} />
    </Tabs>
  )
}
