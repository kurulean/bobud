import 'react-native-get-random-values'
import { useEffect, useState, useRef } from 'react'
import { Animated, StyleSheet, Text } from 'react-native'
import { Stack, router } from 'expo-router'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { supabase } from '../src/lib/supabase'
import { useAuthStore } from '../src/stores/authStore'
import { useThemeStore } from '../src/stores/themeStore'
import OfflineBanner from '../src/components/OfflineBanner'

export default function RootLayout() {
  const session = useAuthStore(s => s.session)
  const profile = useAuthStore(s => s.profile)
  const isGuest = useAuthStore(s => s.isGuest)
  const initialized = useAuthStore(s => s.initialized)
  const setSession = useAuthStore(s => s.setSession)
  const setProfile = useAuthStore(s => s.setProfile)
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

  // Whenever session changes, fetch the user's profile row
  useEffect(() => {
    if (!session?.user) {
      setProfile(null)
      return
    }
    let cancelled = false
    ;(async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, username, avatar_url, created_at')
        .eq('id', session.user.id)
        .maybeSingle()
      if (cancelled) return
      if (error) {
        console.error('[RootLayout] profile fetch failed:', error.message)
        setProfile(null)
      } else {
        setProfile(data as any)
      }
    })()
    return () => { cancelled = true }
  }, [session?.user?.id])

  // Route based on auth + onboarding state
  useEffect(() => {
    if (!initialized) return
    if (isGuest) {
      router.replace('/(tabs)')
    } else if (session) {
      // Signed in: need a username before entering the app
      if (profile && !profile.username) {
        router.replace('/onboarding')
      } else if (profile?.username) {
        router.replace('/(tabs)')
      }
      // else: waiting on profile fetch — don't navigate yet
    } else {
      router.replace('/(auth)/login')
    }
  }, [initialized, isGuest, session, profile])

  // Fade splash out once auth + theme are ready
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
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: '#0D0D0D' },
        }}
      />
      <OfflineBanner />
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
