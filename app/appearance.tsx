import { StyleSheet, Text, View, TouchableOpacity } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { useThemeStore, ThemeMode } from '../src/stores/themeStore'
import { useColors } from '../src/hooks/useColors'

const OPTIONS: { value: ThemeMode; label: string; description: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { value: 'light', label: 'Light', description: 'Bright, airy interface', icon: 'sunny-outline' },
  { value: 'dark', label: 'Dark', description: 'Easy on the eyes', icon: 'moon-outline' },
  { value: 'system', label: 'System', description: 'Matches your device', icon: 'phone-portrait-outline' },
]

export default function AppearanceScreen() {
  const mode = useThemeStore(s => s.mode)
  const setMode = useThemeStore(s => s.setMode)
  const c = useColors()

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: c.background }]} edges={['top']}>
      <View style={[styles.header, { borderBottomColor: c.borderSubtle }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.6}>
          <Ionicons name="chevron-back" size={24} color={c.primaryText} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: c.primaryText }]}>Appearance</Text>
        <View style={styles.backBtn} />
      </View>

      <View style={styles.content}>
        <Text style={[styles.sectionLabel, { color: c.placeholder }]}>Theme</Text>

        <View style={[styles.group, { backgroundColor: c.surface, borderColor: c.border }]}>
          {OPTIONS.map((opt, idx) => {
            const selected = mode === opt.value
            return (
              <View key={opt.value}>
                <TouchableOpacity
                  style={styles.row}
                  onPress={() => setMode(opt.value)}
                  activeOpacity={0.6}
                >
                  <Ionicons name={opt.icon} size={22} color={c.tertiaryText} />
                  <View style={styles.rowInfo}>
                    <Text style={[styles.rowLabel, { color: c.primaryText }]}>{opt.label}</Text>
                    <Text style={[styles.rowDescription, { color: c.secondaryText }]}>
                      {opt.description}
                    </Text>
                  </View>
                  {selected && (
                    <Ionicons name="checkmark-circle" size={22} color={c.accent} />
                  )}
                </TouchableOpacity>
                {idx < OPTIONS.length - 1 && (
                  <View style={[styles.divider, { backgroundColor: c.border }]} />
                )}
              </View>
            )
          })}
        </View>

        <Text style={[styles.hint, { color: c.placeholder }]}>
          Theme preference is saved and will apply across the app.
        </Text>
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    paddingTop: 4,
    paddingBottom: 14,
    borderBottomWidth: 1,
  },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 17, fontWeight: '600' },
  content: { padding: 20, gap: 12 },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginLeft: 4,
  },
  group: {
    borderRadius: 14,
    borderWidth: 1,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 14,
  },
  rowInfo: { flex: 1, gap: 2 },
  rowLabel: { fontSize: 15, fontWeight: '500' },
  rowDescription: { fontSize: 12 },
  divider: { height: 1, marginLeft: 52 },
  hint: {
    fontSize: 12,
    marginTop: 4,
    marginLeft: 4,
  },
})
