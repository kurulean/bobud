import { StyleSheet, Text, View, TouchableOpacity, Alert } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { supabase } from '../../src/lib/supabase'
import { useAuthStore } from '../../src/stores/authStore'

export default function ProfileScreen() {
  const user = useAuthStore(s => s.user)
  const isGuest = useAuthStore(s => s.isGuest)
  const reset = useAuthStore(s => s.reset)

  function handleSignOut() {
    Alert.alert('Sign out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign out',
        style: 'destructive',
        onPress: async () => {
          reset()
          await supabase.auth.signOut()
        },
      },
    ])
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Profile</Text>
      </View>

      <View style={styles.card}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {isGuest ? '?' : (user?.email?.[0].toUpperCase() ?? '?')}
          </Text>
        </View>
        <Text style={styles.name}>
          {isGuest ? 'Guest' : user?.email}
        </Text>
        <Text style={styles.subtitle}>
          {isGuest ? 'Sign in to save reviews' : 'Member'}
        </Text>
      </View>

      <View style={styles.footer}>
        <TouchableOpacity style={styles.signOutButton} onPress={handleSignOut} activeOpacity={0.8}>
          <Text style={styles.signOutLabel}>Sign out</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0D0D0D' },
  header: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1E1E1E',
  },
  title: { fontSize: 20, fontWeight: '700', color: '#FFFFFF' },
  card: {
    alignItems: 'center',
    padding: 32,
    marginTop: 24,
    marginHorizontal: 20,
    backgroundColor: '#1A1A1A',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#2A2A2A',
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#242424',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  avatarText: { fontSize: 28, fontWeight: '600', color: '#FFFFFF' },
  name: { fontSize: 16, fontWeight: '600', color: '#FFFFFF', marginBottom: 4 },
  subtitle: { fontSize: 13, color: '#666666' },
  footer: { padding: 20, marginTop: 'auto' },
  signOutButton: {
    borderWidth: 1,
    borderColor: '#FF3B30',
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
  },
  signOutLabel: { fontSize: 15, fontWeight: '600', color: '#FF3B30' },
})
