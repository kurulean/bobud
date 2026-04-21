import { useState, useMemo, useEffect, useRef } from 'react'
import {
  StyleSheet, Text, View, FlatList, TouchableOpacity,
  Modal, Pressable, Animated, Dimensions, Easing, TextInput,
} from 'react-native'
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { useMapStore, ShopWithDistance } from '../../src/stores/mapStore'
import { haversineDistance } from '../../src/lib/geo'
import { DrinkTag } from '../../src/types'
import { useColors } from '../../src/hooks/useColors'

const DEFAULT_LOCATION = { latitude: 33.6846, longitude: -117.8265 }
const TOP_N = 20
const DRAWER_WIDTH = Math.min(Dimensions.get('window').width * 0.78, 320)

const DRINK_FILTERS: Array<{ tag: DrinkTag | 'All'; emoji: string }> = [
  { tag: 'All', emoji: '🧋' },
  { tag: 'Milk Tea', emoji: '🥛' },
  { tag: 'Fruit Tea', emoji: '🍓' },
  { tag: 'Matcha', emoji: '🍵' },
  { tag: 'Slush', emoji: '🧊' },
  { tag: 'Classic', emoji: '☕' },
]

export default function LeaderboardScreen() {
  const { radius, userLocation, shops, setSelectedShop } = useMapStore()
  const [activeTag, setActiveTag] = useState<DrinkTag | 'All'>('All')
  const [filterOpen, setFilterOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const loc = userLocation ?? DEFAULT_LOCATION
  const c = useColors()
  const insets = useSafeAreaInsets()

  // Drawer slide animation
  const translateX = useRef(new Animated.Value(-DRAWER_WIDTH)).current
  const backdropOpacity = useRef(new Animated.Value(0)).current
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    if (filterOpen) {
      setMounted(true)
      Animated.parallel([
        Animated.timing(translateX, {
          toValue: 0,
          duration: 180,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(backdropOpacity, {
          toValue: 1,
          duration: 180,
          useNativeDriver: true,
        }),
      ]).start()
    } else if (mounted) {
      Animated.parallel([
        Animated.timing(translateX, {
          toValue: -DRAWER_WIDTH,
          duration: 150,
          easing: Easing.in(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(backdropOpacity, {
          toValue: 0,
          duration: 150,
          useNativeDriver: true,
        }),
      ]).start(() => setMounted(false))
    }
  }, [filterOpen])

  function openOnMap(shop: ShopWithDistance) {
    setSelectedShop(shop)
    router.navigate('/(tabs)')
  }

  const rankedShops = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    return shops
      .map(shop => ({
        ...shop,
        distance: haversineDistance(loc.latitude, loc.longitude, shop.lat, shop.lng),
      }))
      .filter(shop => shop.distance <= radius)
      .filter(shop => activeTag === 'All' || shop.tags?.includes(activeTag))
      .filter(shop =>
        !q
          || shop.name.toLowerCase().includes(q)
          || shop.address?.toLowerCase().includes(q)
      )
      .sort((a, b) => b.rating - a.rating)
      .slice(0, TOP_N)
  }, [shops, loc, radius, activeTag, searchQuery])

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: c.background }]} edges={['top']}>
      <View style={[styles.header, { borderBottomColor: c.borderSubtle }]}>
        {searchOpen ? (
          <View style={[styles.searchWrap, { backgroundColor: c.surface, borderColor: c.border }]}>
            <Ionicons name="search" size={16} color={c.placeholder} />
            <TextInput
              style={[styles.searchInput, { color: c.primaryText }]}
              placeholder="Search shops..."
              placeholderTextColor={c.placeholder}
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoFocus
              autoCorrect={false}
              returnKeyType="search"
            />
            <TouchableOpacity
              onPress={() => { setSearchOpen(false); setSearchQuery('') }}
              hitSlop={8}
            >
              <Ionicons name="close-circle" size={18} color={c.placeholder} />
            </TouchableOpacity>
          </View>
        ) : (
          <>
            <TouchableOpacity
              style={styles.iconButton}
              onPress={() => setFilterOpen(true)}
              activeOpacity={0.6}
            >
              <Ionicons name="menu" size={24} color={c.primaryText} />
            </TouchableOpacity>

            <View style={styles.headerText}>
              <Text style={[styles.title, { color: c.primaryText }]}>Boba Leaderboard</Text>
              <Text style={[styles.subtitle, { color: c.secondaryText }]}>
                Within {radius} mi · {activeTag === 'All' ? 'All drinks' : activeTag}
              </Text>
            </View>

            <TouchableOpacity
              style={styles.iconButton}
              onPress={() => setSearchOpen(true)}
              activeOpacity={0.6}
            >
              <Ionicons name="search" size={22} color={c.primaryText} />
            </TouchableOpacity>
          </>
        )}
      </View>

      <FlatList
        data={rankedShops}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <Text style={[styles.empty, { color: c.placeholder }]}>No shops within {radius} mi</Text>
        }
        renderItem={({ item, index }) => (
          <TouchableOpacity
            style={[styles.row, { borderBottomColor: c.surface }]}
            onPress={() => openOnMap(item)}
            activeOpacity={0.75}
          >
            <Text style={[
              styles.rank,
              { color: c.placeholder },
              index === 0 && styles.rankGold,
              index === 1 && styles.rankSilver,
              index === 2 && styles.rankBronze,
            ]}>
              {index + 1}
            </Text>

            <View style={styles.rowInfo}>
              <Text style={[styles.rowName, { color: c.primaryText }]}>{item.name}</Text>
              <View style={styles.rowMeta}>
                <Text style={[styles.rowDistance, { color: c.secondaryText }]}>{item.distance.toFixed(1)} mi</Text>
                <Text style={[styles.rowDot, { color: c.placeholder }]}>·</Text>
                <Text style={[styles.rowReviews, { color: c.secondaryText }]}>{item.review_count} reviews</Text>
              </View>
            </View>

            <View style={[styles.ratingBadge, { backgroundColor: c.surface, borderColor: c.border }]}>
              <Ionicons name="star" size={12} color={c.star} />
              <Text style={[styles.ratingText, { color: c.primaryText }]}>{item.rating.toFixed(1)}</Text>
            </View>
          </TouchableOpacity>
        )}
      />

      <Modal
        visible={mounted}
        transparent
        animationType="none"
        statusBarTranslucent
        onRequestClose={() => setFilterOpen(false)}
      >
        <Animated.View style={[styles.backdrop, { opacity: backdropOpacity }]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setFilterOpen(false)} />
        </Animated.View>

        <Animated.View
          style={[
            styles.drawer,
            {
              width: DRAWER_WIDTH,
              backgroundColor: c.background,
              paddingTop: insets.top,
              paddingBottom: insets.bottom,
              transform: [{ translateX }],
            },
          ]}
        >
          <View style={styles.drawerHeader}>
            <View>
              <Text style={[styles.drawerTitle, { color: c.primaryText }]}>Filters</Text>
              <Text style={[styles.drawerSubtitle, { color: c.secondaryText }]}>
                Within {radius} mi
              </Text>
            </View>
            <TouchableOpacity
              style={[styles.drawerClose, { backgroundColor: c.surface }]}
              onPress={() => setFilterOpen(false)}
              activeOpacity={0.6}
            >
              <Ionicons name="close" size={18} color={c.primaryText} />
            </TouchableOpacity>
          </View>

          <Text style={[styles.sectionLabel, { color: c.placeholder }]}>Drink type</Text>

          <View style={styles.optionsList}>
            {DRINK_FILTERS.map(({ tag, emoji }) => {
              const active = activeTag === tag
              return (
                <TouchableOpacity
                  key={tag}
                  style={[
                    styles.option,
                    {
                      backgroundColor: active ? c.accent : c.surface,
                      borderColor: active ? c.accent : c.border,
                    },
                  ]}
                  onPress={() => {
                    setActiveTag(tag)
                    setFilterOpen(false)
                  }}
                  activeOpacity={0.75}
                >
                  <Text style={styles.optionEmoji}>{emoji}</Text>
                  <Text style={[
                    styles.optionLabel,
                    { color: active ? c.accentText : c.primaryText, fontWeight: active ? '600' : '500' },
                  ]}>
                    {tag}
                  </Text>
                  {active && (
                    <Ionicons name="checkmark" size={18} color={c.accentText} />
                  )}
                </TouchableOpacity>
              )
            })}
          </View>
        </Animated.View>
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
  searchWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
    gap: 8,
    height: 40,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    padding: 0,
  },
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
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: '#1A1A1A', paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: 20, borderWidth: 1, borderColor: '#2A2A2A',
  },
  ratingText: { fontSize: 13, fontWeight: '600', color: '#FFFFFF' },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  drawer: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    shadowColor: '#000',
    shadowOffset: { width: 6, height: 0 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 16,
  },
  drawerHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 24,
  },
  drawerTitle: { fontSize: 22, fontWeight: '700', letterSpacing: -0.3 },
  drawerSubtitle: { fontSize: 13, marginTop: 2 },
  drawerClose: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginLeft: 20,
    marginBottom: 10,
  },
  optionsList: {
    paddingHorizontal: 14,
    gap: 8,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 13,
    borderRadius: 14,
    borderWidth: 1,
    gap: 12,
  },
  optionEmoji: { fontSize: 20 },
  optionLabel: { flex: 1, fontSize: 15 },
})
