import { useEffect, useRef, useState } from 'react'
import {
  View, Text, StyleSheet, TouchableOpacity, Animated,
  PanResponder, Dimensions, Image, FlatList, Alert,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { supabase } from '../lib/supabase'
import { ShopWithDistance } from '../stores/mapStore'
import { useAuthStore } from '../stores/authStore'
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

interface Props {
  shop: ShopWithDistance
  bottomInset: number
  onClose: () => void
}

const { height: SCREEN_H } = Dimensions.get('window')
const COLLAPSED_H = 180
const EXPANDED_H = Math.min(SCREEN_H * 0.75, 640)

export default function ShopDetailSheet({ shop, bottomInset, onClose }: Props) {
  const translateY = useRef(new Animated.Value(EXPANDED_H - COLLAPSED_H)).current
  const currentOffset = useRef(EXPANDED_H - COLLAPSED_H)
  const currentUser = useAuthStore(s => s.user)
  const [reviews, setReviews] = useState<Review[]>([])
  const [loadingReviews, setLoadingReviews] = useState(false)
  const c = useColors()

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
        const { data, error } = await supabase
          .from('reviews')
          .select('id, user_id, rating, text, drink_name, photo_url, created_at')
          .eq('shop_id', shop.id)
          .order('created_at', { ascending: false })
        if (cancelled) return
        if (error) {
          console.error('[ShopDetailSheet] fetch reviews failed:', error.message)
          setReviews([])
        } else {
          setReviews((data ?? []) as Review[])
        }
      } catch (err: any) {
        if (cancelled) return
        console.error('[ShopDetailSheet] fetch reviews threw:', err?.message)
        setReviews([])
      } finally {
        if (!cancelled) setLoadingReviews(false)
      }
    })()

    return () => { cancelled = true }
  }, [shop.id])

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dy) > 4,
      onPanResponderMove: (_, g) => {
        const next = currentOffset.current + g.dy
        const clamped = Math.max(0, Math.min(EXPANDED_H - COLLAPSED_H, next))
        translateY.setValue(clamped)
      },
      onPanResponderRelease: (_, g) => {
        const next = currentOffset.current + g.dy
        // Snap based on position + velocity
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

      <View style={styles.reviewsSection}>
        <Text style={[styles.reviewsTitle, { color: c.secondaryText }]}>Reviews</Text>
        {loadingReviews ? (
          <Text style={[styles.emptyReviews, { color: c.placeholder }]}>Loading…</Text>
        ) : reviews.length === 0 ? (
          <Text style={[styles.emptyReviews, { color: c.placeholder }]}>No reviews yet. Be the first!</Text>
        ) : (
          <FlatList
            data={reviews}
            keyExtractor={r => r.id}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 12 }}
            renderItem={({ item }) => (
              <ReviewRow review={item} c={c} currentUserId={currentUser?.id} />
            )}

            ItemSeparatorComponent={() => <View style={[styles.reviewDivider, { backgroundColor: c.border }]} />}
          />
        )}
      </View>
    </Animated.View>
  )
}

function ReviewRow({ review, c, currentUserId }: {
  review: Review
  c: ColorPalette
  currentUserId?: string
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
              onPress={() => reportReview(review.id, currentUserId!)}
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

  reviewsSection: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 14,
  },
  reviewsTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666666',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 10,
  },
  emptyReviews: {
    fontSize: 13,
    color: '#555555',
    textAlign: 'center',
    paddingVertical: 20,
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
})
