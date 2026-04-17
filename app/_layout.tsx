import 'react-native-get-random-values'
import { useEffect } from 'react'
import { Stack, router } from 'expo-router'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { supabase } from '../src/lib/supabase'
import { useAuthStore } from '../src/stores/authStore'

export default function RootLayout() {
  const { setSession, isGuest, initialized, session } = useAuthStore()

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
    })

    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (!initialized) return
    if (isGuest || session) {
      router.replace('/(tabs)')
    } else {
      router.replace('/')
    }
  }, [initialized, isGuest, session])

  return (
    <SafeAreaProvider>
      <Stack screenOptions={{ headerShown: false }} />
    </SafeAreaProvider>
  )
}
