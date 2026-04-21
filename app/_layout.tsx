import 'react-native-get-random-values'
import { useEffect, useState, useRef } from 'react'
import { Animated, StyleSheet, Text } from 'react-native'
import { Stack, router } from 'expo-router'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { supabase } from '../src/lib/supabase'
import { useAuthStore } from '../src/stores/authStore'
import { useThemeStore } from '../src/stores/themeStore'

export default function RootLayout() {
  const isAuth = useAuthStore(s => !!s.session || s.isGuest)
  const initialized = useAuthStore(s => s.initialized)
  const setSession = useAuthStore(s => s.setSession)
  const initTheme = useThemeStore(s => s.init)
  const themeInitialized = useThemeStore(s => s.initialized)

  const [showSplash, setShowSplash] = useState(true)
  const splashOpacity = useRef(new Animated.Value(1)).current

  useEffect(() => {
    initTheme()

    supabase.auth.getSession()
      .then(({ data: { session } }) => setSession(session))
      .catch(err => {
        console.error('[RootLayout] getSession failed:', err.message)
        setSession(null)
      })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
    })

    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (!initialized) return
    router.replace(isAuth ? '/(tabs)' : '/(auth)/login')
  }, [initialized, isAuth])

  // Fade splash out once both auth + theme are ready
  useEffect(() => {
    if (!initialized || !themeInitialized) return
    const timer = setTimeout(() => {
      Animated.timing(splashOpacity, {
        toValue: 0,
        duration: 500,
        useNativeDriver: true,
      }).start(() => setShowSplash(false))
    }, 350)
    return () => clearTimeout(timer)
  }, [initialized, themeInitialized])

  return (
    <SafeAreaProvider>
      <Stack screenOptions={{ headerShown: false }} />
      {showSplash && (
        <Animated.View
          style={[StyleSheet.absoluteFill, styles.splash, { opacity: splashOpacity }]}
          pointerEvents="none"
        >
          <Text style={styles.splashText}>bobud</Text>
        </Animated.View>
      )}
    </SafeAreaProvider>
  )
}

const styles = StyleSheet.create({
  splash: {
    backgroundColor: '#0D0D0D',
    alignItems: 'center',
    justifyContent: 'center',
  },
  splashText: {
    fontSize: 56,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: -1.5,
  },
})
