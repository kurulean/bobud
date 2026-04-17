import { Redirect } from 'expo-router'
import { useAuthStore } from '../src/stores/authStore'

export default function Index() {
  const isAuth = useAuthStore(s => !!s.session || s.isGuest)
  const initialized = useAuthStore(s => s.initialized)

  if (!initialized) return null

  return <Redirect href={isAuth ? '/(tabs)' : '/(auth)/login'} />
}
