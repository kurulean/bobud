import { useState, useEffect } from 'react'
import {
  StyleSheet, Text, View, TextInput, TouchableOpacity,
  ActivityIndicator, KeyboardAvoidingView, Platform, Alert,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { supabase } from '../src/lib/supabase'
import { useAuthStore } from '../src/stores/authStore'
import { useColors } from '../src/hooks/useColors'

const USERNAME_REGEX = /^[a-zA-Z0-9_]+$/
const MIN_LEN = 3
const MAX_LEN = 20

export default function OnboardingScreen() {
  const user = useAuthStore(s => s.user)
  const setProfile = useAuthStore(s => s.setProfile)
  const c = useColors()

  const [username, setUsername] = useState('')
  const [checking, setChecking] = useState(false)
  const [available, setAvailable] = useState<boolean | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const trimmed = username.trim()
  const isValidFormat = trimmed.length >= MIN_LEN && trimmed.length <= MAX_LEN && USERNAME_REGEX.test(trimmed)

  // Debounced availability check
  useEffect(() => {
    if (!isValidFormat) {
      setAvailable(null)
      return
    }
    let cancelled = false
    setChecking(true)
    const t = setTimeout(async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id')
        .ilike('username', trimmed)
        .neq('id', user?.id ?? '')
        .maybeSingle()
      if (cancelled) return
      setChecking(false)
      if (error) {
        setAvailable(null)
      } else {
        setAvailable(data === null)
      }
    }, 400)
    return () => {
      cancelled = true
      clearTimeout(t)
    }
  }, [trimmed, isValidFormat, user?.id])

  async function handleSubmit() {
    if (!user) return
    if (!isValidFormat || !available) return
    try {
      setSubmitting(true)
      const { data, error } = await supabase
        .from('profiles')
        .upsert({ id: user.id, username: trimmed }, { onConflict: 'id' })
        .select('id, username, avatar_url, created_at')
        .single()
      if (error) throw error
      setProfile(data as any)
    } catch (e: any) {
      Alert.alert('Error', e.message ?? 'Could not save username')
    } finally {
      setSubmitting(false)
    }
  }

  const statusText = !trimmed
    ? ''
    : !isValidFormat
      ? `${MIN_LEN}–${MAX_LEN} letters, numbers, or underscores`
      : checking
        ? 'Checking availability...'
        : available === false
          ? 'Already taken'
          : available === true
            ? 'Available'
            : ''

  const statusColor = !trimmed || checking
    ? c.placeholder
    : !isValidFormat || available === false
      ? c.error
      : available === true
        ? '#4CAF50'
        : c.placeholder

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: c.background }]}>
      <KeyboardAvoidingView
        style={styles.inner}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={styles.hero}>
          <View style={[styles.iconWrap, { backgroundColor: c.accent }]}>
            <Ionicons name="person" size={32} color={c.accentText} />
          </View>
          <Text style={[styles.title, { color: c.primaryText }]}>Pick a username</Text>
          <Text style={[styles.subtitle, { color: c.secondaryText }]}>
            This is how you'll appear in the community.
          </Text>
        </View>

        <View style={styles.form}>
          <View style={[styles.inputWrap, { backgroundColor: c.surface, borderColor: c.border }]}>
            <Text style={[styles.prefix, { color: c.placeholder }]}>@</Text>
            <TextInput
              style={[styles.input, { color: c.primaryText }]}
              placeholder="username"
              placeholderTextColor={c.placeholder}
              value={username}
              onChangeText={setUsername}
              autoCapitalize="none"
              autoCorrect={false}
              maxLength={MAX_LEN}
            />
            {checking && <ActivityIndicator size="small" color={c.placeholder} />}
            {!checking && available === true && (
              <Ionicons name="checkmark-circle" size={20} color="#4CAF50" />
            )}
            {!checking && available === false && (
              <Ionicons name="close-circle" size={20} color={c.error} />
            )}
          </View>
          <Text style={[styles.status, { color: statusColor }]}>{statusText}</Text>

          <TouchableOpacity
            style={[
              styles.primaryButton,
              { backgroundColor: c.accent },
              (!isValidFormat || available !== true || submitting) && { opacity: 0.4 },
            ]}
            onPress={handleSubmit}
            activeOpacity={0.85}
            disabled={!isValidFormat || available !== true || submitting}
          >
            {submitting
              ? <ActivityIndicator color={c.accentText} />
              : <Text style={[styles.primaryLabel, { color: c.accentText }]}>Continue</Text>
            }
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  inner: { flex: 1, paddingHorizontal: 28 },
  hero: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
  },
  iconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  title: { fontSize: 28, fontWeight: '700', letterSpacing: -0.5 },
  subtitle: { fontSize: 14, textAlign: 'center', paddingHorizontal: 20 },
  form: { paddingBottom: 24, gap: 10 },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 16,
    minHeight: 54,
    gap: 4,
  },
  prefix: { fontSize: 17, fontWeight: '500' },
  input: {
    flex: 1,
    fontSize: 17,
    paddingVertical: 14,
  },
  status: {
    fontSize: 12,
    minHeight: 16,
    paddingLeft: 8,
  },
  primaryButton: {
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
    marginTop: 8,
  },
  primaryLabel: { fontSize: 15, fontWeight: '600' },
})
