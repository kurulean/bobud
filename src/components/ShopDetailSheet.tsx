import { useEffect, useRef, useState } from 'react'
import {
  View, Text, StyleSheet, TouchableOpacity, Animated,
  PanResponder, Dimensions, Image, FlatList, Alert,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { supabase } from '../lib/supabase'
import { ShopWithDistance } from '../stores/mapStore'
import { useAuthStore } from '../stores/authStore'
import { useBlocks } from '../hooks/useBlocks'
import { useColors } from '../hooks/useColors'
import type { ColorPalette } from '../lib/colors'

const REPORT_REASONS = [
  { key: 'inappropriate', label: 'Inappropriate content' },
  { key: 'spam', label: 'Spam' },
  { key: 'harassment', label: 'Harassment' },
  { key: 'fake', label: 'Fake / misleading' },
  { key: 'other', label: 'Other' },
]

async function reportReview(reviewId: string, userId: string) {
  Alert.alert(
    'Report review',
    'Why are you reporting this?',
    [
      ...REPORT_REASONS.map(r => ({
        text: r.label,
        onPress: async () => {
          const { error } = await supabase.from('review_reports').insert({
            review_id: reviewId,
            reporter_id: userId,
            reason: r.key,
          })
          if (error && !error.message.includes('duplicate')) {
            Alert.alert('Error', error.message)
          } else {
            Alert.alert('Reported', 'Thank you. Our team will review it.')
          }
        },
      })),
      { text: 'Cancel', style: 'cancel' as const },
    ]
  )
}

function showReviewActions(opts: {
  reviewId: string
  reviewAuthorId: string
  currentUserId: string
  onBlock: () => void
}) {
  Alert.alert('Options', undefined, [
    { text: 'Report review', onPress: () => reportReview(opts.reviewId, opts.currentUserId) },
    { text: 'Block user', style: 'destructive', onPress: opts.onBlock },
    { text: 'Cancel', style: 'cancel' },
  ])
}

interface Review {
  id: string
  user_id: string
  rating: number
  text: string | null
  drink_name: string | null
  photo_url: string | null
  created_at: string
  profiles?: { username: string } | null
}

interface MenuItem {
  id: string
  name: string
  category: string | null
  price: number | null
  calories: number | null
}

interface Props {
  shop: ShopWithDistance
  bottomInset: number
  onClose: () => void
}

const { height: SCREEN_H } = Dimensions.get('window')
const COLLAPSED_H = 180
const EXPANDED_H = SCREEN_H * 0.85

export default function ShopDetailSheet({ shop, bottomInset, onClose }: Props) {
  const translateY = useRef(new Animated.Value(EXPANDED_H - COLLAPSED_H)).current
  const currentOffset = useRef(EXPANDED_H - COLLAPSED_H)
  const currentUser = useAuthStore(s => s.user)
  const { blockedIds, block } = useBlocks()
  const [reviews, setReviews] = useState<Review[]>([])
  const [loadingReviews, setLoadingReviews] = useState(false)
  const [menu, setMenu] = useState<MenuItem[]>([])
  const [section, setSection] = useState<'menu' | 'reviews'>('menu')
  const [drinkFilter, setDrinkFilter] = useState<string | null>(null)
  const c = useColors()

  const visibleReviews = reviews.filter(r => !blockedIds.includes(r.user_id))
  const filteredReviews = drinkFilter
    ? visibleReviews.filter(r => matchesDrink(r.drink_name, drinkFilter))
    : visibleReviews

  function handleMenuItemPress(name: string) {
    setDrinkFilter(name)
    setSection('reviews')
  }

  // Snap helpers
  const snapTo = (offset: number) => {
    currentOffset.current = offset
    Animated.spring(translateY, {
      toValue: offset,
      useNativeDriver: true,
      bounciness: 0,
      speed: 20,
    }).start()
  }

  useEffect(() => {
    snapTo(EXPANDED_H - COLLAPSED_H)

    let cancelled = false
    setLoadingReviews(true)

    ;(async () => {
      try {
        const [reviewsResult, menuResult] = await Promise.all([
          supabase
            .from('reviews')
            .select('id, user_id, rating, text, drink_name, photo_url, created_at')
            .eq('shop_id', shop.id)
            .order('created_at', { ascending: false }),
          supabase
            .from('menu_items')
            .select('id, name, category, price, calories')
            .eq('shop_id', shop.id)
            .order('category', { ascending: true }),
        ])

        if (cancelled) return

        if (reviewsResult.error) {
          console.error('[ShopDetailSheet] fetch reviews failed:', reviewsResult.error.message)
          setReviews([])
        } else {
          setReviews((reviewsResult.data ?? []) as Review[])
        }

        if (menuResult.error) {
          console.error('[ShopDetailSheet] fetch menu failed:', menuResult.error.message)
          setMenu([])
        } else {
          setMenu((menuResult.data ?? []) as MenuItem[])
        }

        // Default to menu tab if there are items, else reviews
        if ((menuResult.data?.length ?? 0) === 0) setSection('reviews')
        else setSection('menu')
      } catch (err: any) {
        if (cancelled) return
        console.error('[ShopDetailSheet] fetch threw:', err?.message)
        setReviews([])
        setMenu([])
      } finally {
        if (!cancelled) setLoadingReviews(false)
      }
    })()

    return () => { cancelled = true }
  }, [shop.id])

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, g) =>
        Math.abs(g.dy) > 10 && Math.abs(g.dy) > Math.abs(g.dx) * 1.5,
      onPanResponderTerminationRequest: () => false,
      onPanResponderMove: (_, g) => {
        const next = currentOffset.current + g.dy
        const clamped = Math.max(0, Math.min(EXPANDED_H - COLLAPSED_H, next))
        translateY.setValue(clamped)
      },
      onPanResponderRelease: (_, g) => {
        const next = currentOffset.current + g.dy
        if (g.vy > 0.5) {
          snapTo(EXPANDED_H - COLLAPSED_H)
        } else if (g.vy < -0.5) {
          snapTo(0)
        } else {
          const mid = (EXPANDED_H - COLLAPSED_H) / 2
          snapTo(next < mid ? 0 : EXPANDED_H - COLLAPSED_H)
        }
      },
    })
  ).current

  return (
    <Animated.View
      style={[
        styles.sheet,
        {
          height: EXPANDED_H,
          paddingBottom: bottomInset + 12,
          transform: [{ translateY }],
          backgroundColor: c.surface,
          borderColor: c.border,
        },
      ]}
    >
      <View {...panResponder.panHandlers} style={[styles.draggable, { backgroundColor: c.surface }]}>
        <View style={styles.handleArea}>
          <View style={[styles.handle, { backgroundColor: c.border }]} />
        </View>

        <View style={[styles.header, { borderBottomColor: c.border }]}>
          <View style={styles.headerInfo}>
            <Text style={[styles.name, { color: c.primaryText }]}>{shop.name}</Text>
            <Text style={[styles.address, { color: c.secondaryText }]} numberOfLines={1}>{shop.address}</Text>
            <View style={styles.meta}>
              <Ionicons name="star" size={12} color={c.star} />
              <Text style={[styles.rating, { color: c.primaryText }]}>{shop.rating.toFixed(1)}</Text>
              <Text style={[styles.dot, { color: c.placeholder }]}>·</Text>
              <Text style={[styles.distance, { color: c.tertiaryText }]}>{shop.distance.toFixed(1)} mi</Text>
              <Text style={[styles.dot, { color: c.placeholder }]}>·</Text>
              <Text style={[styles.reviewCount, { color: c.tertiaryText }]}>{shop.review_count} reviews</Text>
            </View>
          </View>
          <TouchableOpacity onPress={onClose} style={[styles.closeBtn, { backgroundColor: c.surfaceAlt }]}>
            <Ionicons name="close" size={20} color={c.primaryText} />
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.tabsRow}>
        <TouchableOpacity
          style={[styles.tab, section === 'menu' && { borderBottomColor: c.accent }]}
          onPress={() => { setSection('menu'); setDrinkFilter(null) }}
          activeOpacity={0.7}
        >
          <Text style={[
            styles.tabLabel,
            { color: section === 'menu' ? c.primaryText : c.secondaryText },
          ]}>
            Menu {menu.length > 0 && <Text style={{ color: c.placeholder }}>· {menu.length}</Text>}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, section === 'reviews' && { borderBottomColor: c.accent }]}
          onPress={() => setSection('reviews')}
          activeOpacity={0.7}
        >
          <Text style={[
            styles.tabLabel,
            { color: section === 'reviews' ? c.primaryText : c.secondaryText },
          ]}>
            Reviews {reviews.length > 0 && <Text style={{ color: c.placeholder }}>· {reviews.length}</Text>}
          </Text>
        </TouchableOpacity>
      </View>

      <View style={styles.contentSection}>
        {loadingReviews ? (
          <Text style={[styles.emptyState, { color: c.placeholder }]}>Loading…</Text>
        ) : section === 'menu' ? (
          menu.length === 0 ? (
            <Text style={[styles.emptyState, { color: c.placeholder }]}>No menu available yet.</Text>
          ) : (
            <FlatList
              data={groupMenu(menu)}
              keyExtractor={g => g.category ?? 'uncategorized'}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: 12 }}
              renderItem={({ item }) => (
                <MenuCategory group={item} c={c} onItemPress={handleMenuItemPress} />
              )}
            />
          )
        ) : (
          <>
            {drinkFilter && (
              <View style={[styles.filterChip, { backgroundColor: c.accent }]}>
                <Ionicons name="filter" size={12} color={c.accentText} />
                <Text style={[styles.filterChipLabel, { color: c.accentText }]} numberOfLines={1}>
                  {drinkFilter}
                </Text>
                <TouchableOpacity onPress={() => setDrinkFilter(null)} hitSlop={8}>
                  <Ionicons name="close" size={14} color={c.accentText} />
                </TouchableOpacity>
              </View>
            )}
            {filteredReviews.length === 0 ? (
              <Text style={[styles.emptyState, { color: c.placeholder }]}>
                {drinkFilter
                  ? `No reviews for "${drinkFilter}" yet.`
                  : 'No reviews yet. Be the first!'}
              </Text>
            ) : (
              <FlatList
                data={filteredReviews}
                keyExtractor={r => r.id}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingBottom: 12 }}
                renderItem={({ item }) => (
                  <ReviewRow
                    review={item}
                    c={c}
                    currentUserId={currentUser?.id}
                    onBlock={() => {
                      Alert.alert(
                        'Block user?',
                        "You won't see their reviews or comments anymore.",
                        [
                          { text: 'Cancel', style: 'cancel' },
                          {
                            text: 'Block',
                            style: 'destructive',
                            onPress: async () => {
                              const { error } = await block(item.user_id)
                              if (error) Alert.alert('Block failed', error)
                            },
                          },
                        ]
                      )
                    }}
                  />
                )}
                ItemSeparatorComponent={() => <View style={[styles.reviewDivider, { backgroundColor: c.border }]} />}
              />
            )}
          </>
        )}
      </View>
    </Animated.View>
  )
}

function matchesDrink(reviewDrinkName: string | null, filter: string): boolean {
  if (!reviewDrinkName) return false
  const a = reviewDrinkName.toLowerCase().trim()
  const b = filter.toLowerCase().trim()
  if (!a || !b) return false
  return a === b || a.includes(b) || b.includes(a)
}

function groupMenu(items: MenuItem[]): { category: string | null; items: MenuItem[] }[] {
  const map = new Map<string, MenuItem[]>()
  for (const item of items) {
    const key = item.category ?? 'Other'
    if (!map.has(key)) map.set(key, [])
    map.get(key)!.push(item)
  }
  return Array.from(map.entries()).map(([category, items]) => ({ category, items }))
}

function MenuCategory({ group, c, onItemPress }: {
  group: { category: string | null; items: MenuItem[] }
  c: ColorPalette
  onItemPress: (name: string) => void
}) {
  return (
    <View style={{ marginBottom: 14 }}>
      {group.category && (
        <Text style={[styles.menuCategoryLabel, { color: c.secondaryText }]}>
          {group.category}
        </Text>
      )}
      {group.items.map(item => (
        <TouchableOpacity
          key={item.id}
          style={styles.menuItemRow}
          onPress={() => onItemPress(item.name)}
          activeOpacity={0.6}
        >
          <View style={{ flex: 1 }}>
            <Text style={[styles.menuItemName, { color: c.primaryText }]} numberOfLines={1}>
              {item.name}
            </Text>
            {item.calories != null && (
              <Text style={[styles.menuItemCalories, { color: c.placeholder }]}>
                {item.calories} cal
              </Text>
            )}
          </View>
          {item.price != null && (
            <Text style={[styles.menuItemPrice, { color: c.primaryText }]}>
              ${Number(item.price).toFixed(2)}
            </Text>
          )}
          <Ionicons name="chevron-forward" size={14} color={c.placeholder} />
        </TouchableOpacity>
      ))}
    </View>
  )
}

function ReviewRow({ review, c, currentUserId, onBlock }: {
  review: Review
  c: ColorPalette
  currentUserId?: string
  onBlock: () => void
}) {
  const canReport = !!currentUserId && currentUserId !== review.user_id
  return (
    <View style={styles.reviewRow}>
      {review.photo_url && (
        <Image source={{ uri: review.photo_url }} style={[styles.reviewPhoto, { backgroundColor: c.surfaceAlt }]} />
      )}
      <View style={{ flex: 1 }}>
        <View style={styles.reviewHeader}>
          <View style={styles.starsRow}>
            {[1, 2, 3, 4, 5].map(n => (
              <Ionicons
                key={n}
                name={n <= review.rating ? 'star' : 'star-outline'}
                size={12}
                color={n <= review.rating ? c.star : c.border}
              />
            ))}
          </View>
          {review.drink_name && (
            <Text style={[styles.drinkName, { color: c.tertiaryText }]}>{review.drink_name}</Text>
          )}
          <View style={{ flex: 1 }} />
          {canReport && (
            <TouchableOpacity
              onPress={() => showReviewActions({
                reviewId: review.id,
                reviewAuthorId: review.user_id,
                currentUserId: currentUserId!,
                onBlock,
              })}
              hitSlop={8}
              style={styles.reportBtn}
            >
              <Ionicons name="ellipsis-horizontal" size={14} color={c.placeholder} />
            </TouchableOpacity>
          )}
        </View>
        {review.text && <Text style={[styles.reviewText, { color: c.primaryText }]}>{review.text}</Text>}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  sheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#1A1A1A',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderWidth: 1,
    borderColor: '#2A2A2A',
    paddingTop: 4,
  },
  draggable: {
    backgroundColor: '#1A1A1A',
  },
  handleArea: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#3A3A3A',
  },

  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 20,
    paddingBottom: 16,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#2A2A2A',
  },
  headerInfo: { flex: 1, gap: 3 },
  name: { fontSize: 17, fontWeight: '700', color: '#FFFFFF' },
  address: { fontSize: 13, color: '#666666' },
  meta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  rating: { fontSize: 13, color: '#FFFFFF', fontWeight: '500' },
  dot: { fontSize: 13, color: '#444444' },
  distance: { fontSize: 13, color: '#AAAAAA' },
  reviewCount: { fontSize: 13, color: '#AAAAAA' },
  closeBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#242424',
    alignItems: 'center',
    justifyContent: 'center',
  },

  tabsRow: {
    flexDirection: 'row',
    paddingHorizontal: 20,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabLabel: {
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  contentSection: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  emptyState: {
    fontSize: 13,
    textAlign: 'center',
    paddingVertical: 20,
  },
  menuCategoryLabel: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 6,
  },
  menuItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    gap: 12,
  },
  menuItemName: {
    fontSize: 14,
    fontWeight: '500',
  },
  menuItemCalories: {
    fontSize: 11,
    marginTop: 2,
  },
  menuItemPrice: {
    fontSize: 14,
    fontWeight: '600',
  },

  reviewRow: {
    flexDirection: 'row',
    gap: 12,
    paddingVertical: 10,
  },
  reviewPhoto: {
    width: 56,
    height: 56,
    borderRadius: 10,
    backgroundColor: '#242424',
  },
  reviewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  reportBtn: {
    padding: 4,
  },
  starsRow: {
    flexDirection: 'row',
    gap: 2,
  },
  drinkName: {
    fontSize: 12,
    color: '#AAAAAA',
    fontWeight: '500',
  },
  reviewText: {
    fontSize: 13,
    color: '#CCCCCC',
    lineHeight: 18,
  },
  reviewDivider: {
    height: 1,
    backgroundColor: '#2A2A2A',
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 14,
    marginBottom: 10,
    maxWidth: '100%',
  },
  filterChipLabel: { fontSize: 12, fontWeight: '600', flexShrink: 1 },
})
