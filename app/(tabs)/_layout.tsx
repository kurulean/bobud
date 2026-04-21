import { createMaterialTopTabNavigator } from '@react-navigation/material-top-tabs'
import { withLayoutContext } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { View, StyleSheet } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useColors } from '../../src/hooks/useColors'

const { Navigator } = createMaterialTopTabNavigator()
const MaterialTopTabs = withLayoutContext(Navigator)

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
    <MaterialTopTabs
      tabBarPosition="bottom"
      screenOptions={{
        tabBarShowLabel: false,
        tabBarShowIcon: true,
        tabBarIndicatorStyle: { backgroundColor: c.accent, height: 2, top: 0 },
        tabBarStyle: {
          backgroundColor: c.background,
          borderTopColor: c.borderSubtle,
          borderTopWidth: 1,
          height: 60 + insets.bottom,
          paddingBottom: insets.bottom,
          elevation: 0,
          shadowOpacity: 0,
        },
        tabBarItemStyle: {
          paddingVertical: 0,
        },
        tabBarPressColor: 'transparent',
        swipeEnabled: true,
        animationEnabled: true,
        lazy: true,
      }}
    >
      <MaterialTopTabs.Screen
        name="leaderboard"
        options={{
          tabBarIcon: ({ focused }: { focused: boolean }) => (
            <TabIcon focused={focused} name="trophy-outline" active="trophy" color={c.primaryText} />
          ),
        }}
      />
      <MaterialTopTabs.Screen
        name="index"
        options={{
          tabBarIcon: ({ focused }: { focused: boolean }) => (
            <TabIcon focused={focused} name="map-outline" active="map" color={c.primaryText} />
          ),
        }}
      />
      <MaterialTopTabs.Screen
        name="camera"
        options={{
          tabBarIcon: ({ focused }: { focused: boolean }) => (
            <TabIcon focused={focused} name="camera-outline" active="camera" color={c.primaryText} />
          ),
        }}
      />
      <MaterialTopTabs.Screen
        name="ratings"
        options={{
          tabBarIcon: ({ focused }: { focused: boolean }) => (
            <TabIcon focused={focused} name="star-outline" active="star" color={c.primaryText} />
          ),
        }}
      />
      <MaterialTopTabs.Screen
        name="profile"
        options={{
          tabBarIcon: ({ focused }: { focused: boolean }) => (
            <TabIcon focused={focused} name="person-circle-outline" active="person-circle" color={c.primaryText} />
          ),
        }}
      />
    </MaterialTopTabs>
  )
}

const styles = StyleSheet.create({
  iconWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    height: 44,
  },
})
