import { useState, useEffect } from 'react'
import {
  StyleSheet, Text, View, TouchableOpacity,
  Alert, ActivityIndicator, TextInput, KeyboardAvoidingView, Platform,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import * as AppleAuthentication from 'expo-apple-authentication'
import * as WebBrowser from 'expo-web-browser'
import * as Crypto from 'expo-crypto'
import * as Google from 'expo-auth-session/providers/google'
import { supabase } from '../../src/lib/supabase'
import { useColors } from '../../src/hooks/useColors'

WebBrowser.maybeCompleteAuthSession()

const GOOGLE_IOS_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID

function makeRawNonce(): string {
  return [...Array(32)]
    .map(() => Math.floor(Math.random() * 36).toString(36))
    .join('')
}

export default function LoginScreen() {
  const [mode, setMode] = useState<'signin' | 'signup'>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [appleAvailable, setAppleAvailable] = useState(false)
  const [rawNonce] = useState(() => makeRawNonce())
  const [hashedNonce, setHashedNonce] = useState<string | null>(null)

  const c = useColors()

  useEffect(() => {
    AppleAuthentication.isAvailableAsync().then(setAppleAvailable)
    Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, rawNonce).then(setHashedNonce)
  }, [])

  const [googleRequest, googleResponse, promptGoogle] = Google.useIdTokenAuthRequest({
    iosClientId: GOOGLE_IOS_CLIENT_ID,
    scopes: ['openid', 'profile', 'email'],
    extraParams: hashedNonce ? { nonce: hashedNonce } : undefined,
  })

  useEffect(() => {
    if (googleResponse?.type === 'success') {
      const idToken = (googleResponse.params as any).id_token
      if (!idToken) {
        setGoogleLoading(false)
        return
      }
      ;(async () => {
        try {
          const { error } = await supabase.auth.signInWithIdToken({
            provider: 'google',
            token: idToken,
            nonce: rawNonce,
          })
          if (error) throw error
        } catch (e: any) {
          Alert.alert('Google sign in failed', e.message ?? 'Unknown error')
        } finally {
          setGoogleLoading(false)
        }
      })()
    } else if (googleResponse?.type === 'error' || googleResponse?.type === 'cancel') {
      setGoogleLoading(false)
    }
  }, [googleResponse])

  async function handleGoogle() {
    if (!googleRequest || !hashedNonce) return
    setGoogleLoading(true)
    await promptGoogle()
  }

  async function handleApple() {
    try {
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
        nonce: hashedNonce ?? undefined,
      })
      if (!credential.identityToken) throw new Error('No identity token from Apple')
      const { error } = await supabase.auth.signInWithIdToken({
        provider: 'apple',
        token: credential.identityToken,
        nonce: rawNonce,
      })
      if (error) throw error
    } catch (e: any) {
      if (e.code === 'ERR_REQUEST_CANCELED') return
      Alert.alert('Apple sign in failed', e.message ?? 'Unknown error')
    }
  }

  async function handleSubmit() {
    if (!email || !password) {
      Alert.alert('Missing fields', 'Please enter your email and password.')
      return
    }
    try {
      setLoading(true)
      if (mode === 'signup') {
        const { error } = await supabase.auth.signUp({ email, password })
        if (error) throw error
        Alert.alert('Check your email', 'We sent you a confirmation link.')
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
      }
    } catch (e: any) {
      Alert.alert('Error', e.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: c.background }]}>
      <KeyboardAvoidingView
        style={styles.inner}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={styles.hero}>
          <Text style={[styles.appName, { color: c.primaryText }]}>bobud</Text>
          <Text style={[styles.tagline, { color: c.secondaryText }]}>find your next spot</Text>
        </View>

        <View style={styles.form}>
          <TextInput
            style={[styles.input, { backgroundColor: c.surface, borderColor: c.border, color: c.primaryText }]}
            placeholder="Email"
            placeholderTextColor={c.placeholder}
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
          />
          <TextInput
            style={[styles.input, { backgroundColor: c.surface, borderColor: c.border, color: c.primaryText }]}
            placeholder="Password"
            placeholderTextColor={c.placeholder}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />

          <TouchableOpacity
            style={[styles.primaryButton, { backgroundColor: c.accent }]}
            onPress={handleSubmit}
            activeOpacity={0.85}
            disabled={loading || googleLoading}
          >
            {loading
              ? <ActivityIndicator color={c.accentText} />
              : <Text style={[styles.primaryLabel, { color: c.accentText }]}>
                  {mode === 'signin' ? 'Sign In' : 'Create Account'}
                </Text>
            }
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setMode(mode === 'signin' ? 'signup' : 'signin')}
            activeOpacity={0.6}
          >
            <Text style={[styles.toggleLabel, { color: c.secondaryText }]}>
              {mode === 'signin'
                ? "Don't have an account? Sign up"
                : 'Already have an account? Sign in'}
            </Text>
          </TouchableOpacity>

          <View style={styles.dividerRow}>
            <View style={[styles.dividerLine, { backgroundColor: c.border }]} />
            <Text style={[styles.dividerText, { color: c.placeholder }]}>or</Text>
            <View style={[styles.dividerLine, { backgroundColor: c.border }]} />
          </View>

          <TouchableOpacity
            style={[styles.oauthButton, { backgroundColor: c.surface, borderColor: c.border }]}
            onPress={handleGoogle}
            activeOpacity={0.85}
            disabled={googleLoading || loading || !googleRequest}
          >
            {googleLoading
              ? <ActivityIndicator color={c.primaryText} />
              : (
                <>
                  <Ionicons name="logo-google" size={18} color={c.primaryText} />
                  <Text style={[styles.oauthLabel, { color: c.primaryText }]}>Continue with Google</Text>
                </>
              )
            }
          </TouchableOpacity>

          {Platform.OS === 'ios' && appleAvailable && (
            <AppleAuthentication.AppleAuthenticationButton
              buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
              buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.WHITE}
              cornerRadius={14}
              style={styles.appleButton}
              onPress={handleApple}
            />
          )}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0D0D0D' },
  inner: { flex: 1, paddingHorizontal: 28 },
  hero: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  appName: {
    fontSize: 40,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: -1,
  },
  tagline: { fontSize: 15, color: '#666666' },
  form: { paddingBottom: 16, gap: 12 },
  input: {
    borderWidth: 1,
    borderColor: '#2A2A2A',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    color: '#FFFFFF',
    backgroundColor: '#1A1A1A',
  },
  primaryButton: {
    backgroundColor: '#111d4a',
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
  },
  primaryLabel: { fontSize: 15, fontWeight: '600', color: '#FFFFFF' },
  toggleLabel: { fontSize: 13, color: '#555555', textAlign: 'center' },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginVertical: 4,
  },
  dividerLine: { flex: 1, height: 1, backgroundColor: '#2A2A2A' },
  dividerText: { fontSize: 13, color: '#444444' },
  oauthButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: 14,
    gap: 10,
    minHeight: 52,
  },
  oauthLabel: { fontSize: 15, fontWeight: '600' },
  appleButton: { height: 52, width: '100%' },
})
