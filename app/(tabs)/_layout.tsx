import { Tabs } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { View, StyleSheet } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useColors } from '../../src/hooks/useColors'

function TabIcon({
  focused, name, active, color,
}: {
  focused: boolean
  name: keyof typeof Ionicons.glyphMap
  active: keyof typeof Ionicons.glyphMap
  color: string
}) {
  return (
    <View style={styles.iconWrap}>
      <Ionicons
        name={focused ? active : name}
        size={24}
        color={color}
        style={{ opacity: focused ? 1 : 0.35 }}
      />
    </View>
  )
}

export default function TabLayout() {
  const c = useColors()
  const insets = useSafeAreaInsets()

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        animation: 'fade',
        transitionSpec: {
          animation: 'timing',
          config: { duration: 80 },
        },
        tabBarShowLabel: false,
        tabBarActiveTintColor: c.primaryText,
        tabBarInactiveTintColor: c.primaryText,
        tabBarStyle: {
          backgroundColor: c.background,
          borderTopColor: c.borderSubtle,
          borderTopWidth: 1,
          height: 60 + insets.bottom,
          paddingBottom: insets.bottom,
          elevation: 0,
          shadowOpacity: 0,
        },
        sceneStyle: {
          backgroundColor: c.background,
        },
      }}
    >
      <Tabs.Screen
        name="leaderboard"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon focused={focused} name="trophy-outline" active="trophy" color={c.primaryText} />
          ),
        }}
      />
      <Tabs.Screen
        name="index"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon focused={focused} name="map-outline" active="map" color={c.primaryText} />
          ),
        }}
      />
      <Tabs.Screen
        name="camera"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon focused={focused} name="camera-outline" active="camera" color={c.primaryText} />
          ),
        }}
      />
      <Tabs.Screen
        name="social"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon focused={focused} name="albums-outline" active="albums" color={c.primaryText} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon focused={focused} name="person-circle-outline" active="person-circle" color={c.primaryText} />
          ),
        }}
      />
    </Tabs>
  )
}

const styles = StyleSheet.create({
  iconWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    height: 44,
  },
})
