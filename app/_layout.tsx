import 'react-native-get-random-values'
import { useEffect } from 'react'
import { Stack, router } from 'expo-router'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { supabase } from '../src/lib/supabase'
import { useAuthStore } from '../src/stores/authStore'

export default function RootLayout() {
  const isAuth = useAuthStore(s => !!s.session || s.isGuest)
  const initialized = useAuthStore(s => s.initialized)
  const setSession = useAuthStore(s => s.setSession)

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
    router.replace(isAuth ? '/(tabs)' : '/(auth)/login')
  }, [initialized, isAuth])

  return (
    <SafeAreaProvider>
      <Stack screenOptions={{ headerShown: false }} />
    </SafeAreaProvider>
  )
}
