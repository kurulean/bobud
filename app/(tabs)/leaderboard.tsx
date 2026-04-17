import { useState, useMemo } from 'react'
import {
  StyleSheet, Text, View, FlatList, TouchableOpacity,
  Modal, Pressable,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { useMapStore } from '../../src/stores/mapStore'
import { haversineDistance } from '../../src/lib/geo'
import { DrinkTag } from '../../src/types'

const DEFAULT_LOCATION = { latitude: 33.6846, longitude: -117.8265 }
const TOP_N = 20

const DRINK_FILTERS: Array<DrinkTag | 'All'> = [
  'All', 'Milk Tea', 'Fruit Tea', 'Matcha', 'Slush', 'Classic',
]

export default function LeaderboardScreen() {
  const { radius, userLocation, shops } = useMapStore()
  const [activeTag, setActiveTag] = useState<DrinkTag | 'All'>('All')
  const [filterOpen, setFilterOpen] = useState(false)
  const loc = userLocation ?? DEFAULT_LOCATION

  const rankedShops = useMemo(() => {
    return shops
      .map(shop => ({
        ...shop,
        distance: haversineDistance(loc.latitude, loc.longitude, shop.lat, shop.lng),
      }))
      .filter(shop => shop.distance <= radius)
      .filter(shop => activeTag === 'All' || shop.tags?.includes(activeTag))
      .sort((a, b) => b.rating - a.rating)
      .slice(0, TOP_N)
  }, [shops, loc, radius, activeTag])

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.iconButton}
          onPress={() => setFilterOpen(true)}
          activeOpacity={0.6}
        >
          <Ionicons name="menu" size={24} color="#FFFFFF" />
        </TouchableOpacity>

        <View style={styles.headerText}>
          <Text style={styles.title}>Boba Leaderboard</Text>
          <Text style={styles.subtitle}>
            Within {radius} mi · {activeTag === 'All' ? 'All drinks' : activeTag}
          </Text>
        </View>
      </View>

      <FlatList
        data={rankedShops}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <Text style={styles.empty}>No shops within {radius} mi</Text>
        }
        renderItem={({ item, index }) => (
          <TouchableOpacity
            style={styles.row}
            onPress={() => router.push({ pathname: '/shop/[id]', params: { id: item.id } })}
            activeOpacity={0.75}
          >
            <Text style={[
              styles.rank,
              index === 0 && styles.rankGold,
              index === 1 && styles.rankSilver,
              index === 2 && styles.rankBronze,
            ]}>
              {index + 1}
            </Text>

            <View style={styles.rowInfo}>
              <Text style={styles.rowName}>{item.name}</Text>
              <View style={styles.rowMeta}>
                <Text style={styles.rowDistance}>{item.distance.toFixed(1)} mi</Text>
                <Text style={styles.rowDot}>·</Text>
                <Text style={styles.rowReviews}>{item.review_count} reviews</Text>
              </View>
            </View>

            <View style={styles.ratingBadge}>
              <Text style={styles.ratingText}>⭐ {item.rating.toFixed(1)}</Text>
            </View>
          </TouchableOpacity>
        )}
      />

      <Modal
        visible={filterOpen}
        animationType="slide"
        transparent
        onRequestClose={() => setFilterOpen(false)}
      >
        <Pressable style={styles.backdrop} onPress={() => setFilterOpen(false)} />
        <View style={styles.sheet}>
          <View style={styles.sheetHandle} />
          <Text style={styles.sheetTitle}>Filter by drink</Text>

          {DRINK_FILTERS.map(tag => {
            const active = activeTag === tag
            return (
              <TouchableOpacity
                key={tag}
                style={styles.option}
                onPress={() => {
                  setActiveTag(tag)
                  setFilterOpen(false)
                }}
                activeOpacity={0.75}
              >
                <Text style={[styles.optionLabel, active && styles.optionLabelActive]}>
                  {tag}
                </Text>
                {active && <Ionicons name="checkmark" size={20} color="#FFFFFF" />}
              </TouchableOpacity>
            )
          })}
        </View>
      </Modal>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0D0D0D' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#1E1E1E',
    gap: 8,
  },
  iconButton: {
    width: 40, height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerText: { flex: 1 },
  title: { fontSize: 20, fontWeight: '700', color: '#FFFFFF' },
  subtitle: { fontSize: 13, color: '#666666', marginTop: 2 },
  list: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 16 },
  empty: { textAlign: 'center', color: '#555555', marginTop: 60, fontSize: 14 },
  row: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: '#1A1A1A',
    gap: 14,
  },
  rank: { width: 28, fontSize: 16, fontWeight: '700', color: '#555555', textAlign: 'center' },
  rankGold: { color: '#FFD700' },
  rankSilver: { color: '#C0C0C0' },
  rankBronze: { color: '#CD7F32' },
  rowInfo: { flex: 1, gap: 3 },
  rowName: { fontSize: 15, fontWeight: '600', color: '#FFFFFF' },
  rowMeta: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  rowDistance: { fontSize: 12, color: '#666666' },
  rowDot: { fontSize: 12, color: '#444444' },
  rowReviews: { fontSize: 12, color: '#666666' },
  ratingBadge: {
    backgroundColor: '#1A1A1A', paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: 20, borderWidth: 1, borderColor: '#2A2A2A',
  },
  ratingText: { fontSize: 13, fontWeight: '600', color: '#FFFFFF' },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  sheet: {
    position: 'absolute',
    bottom: 0, left: 0, right: 0,
    backgroundColor: '#1A1A1A',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderTopWidth: 1,
    borderColor: '#2A2A2A',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 32,
  },
  sheetHandle: {
    alignSelf: 'center',
    width: 36, height: 4,
    borderRadius: 2,
    backgroundColor: '#3A3A3A',
    marginBottom: 16,
  },
  sheetTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666666',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#2A2A2A',
  },
  optionLabel: {
    fontSize: 15,
    color: '#888888',
  },
  optionLabelActive: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
})
