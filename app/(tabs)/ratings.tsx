import { StyleSheet, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useColors } from '../../src/hooks/useColors'

export default function RatingsScreen() {
  const c = useColors()
  return (
    <SafeAreaView style={[styles.container, { backgroundColor: c.background }]}>
      <View style={[styles.header, { borderBottomColor: c.borderSubtle }]}>
        <Text style={[styles.title, { color: c.primaryText }]}>Your Ratings</Text>
      </View>
      <View style={styles.empty}>
        <Text style={[styles.emptyText, { color: c.secondaryText }]}>No ratings yet</Text>
        <Text style={[styles.emptySub, { color: c.placeholder }]}>Snap a drink in the Camera tab to get started</Text>
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 14,
    borderBottomWidth: 1,
  },
  title: { fontSize: 20, fontWeight: '700' },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  emptyText: { fontSize: 16, marginBottom: 8 },
  emptySub: { fontSize: 13, textAlign: 'center' },
})
