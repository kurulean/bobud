import { useEffect, useState } from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import NetInfo from '@react-native-community/netinfo'
import { useColors } from '../hooks/useColors'

export default function OfflineBanner() {
  const [online, setOnline] = useState(true)
  const c = useColors()
  const insets = useSafeAreaInsets()

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener(state => {
      setOnline(state.isConnected === true && state.isInternetReachable !== false)
    })
    return () => unsubscribe()
  }, [])

  if (online) return null

  return (
    <View
      pointerEvents="none"
      style={[styles.banner, { backgroundColor: c.error, top: insets.top + 8 }]}
    >
      <Text style={styles.text}>No internet connection</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  banner: {
    position: 'absolute',
    left: 16,
    right: 16,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 10,
    alignItems: 'center',
    zIndex: 9999,
  },
  text: { color: '#FFFFFF', fontSize: 13, fontWeight: '600' },
})
