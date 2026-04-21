import { useEffect, useState, useCallback } from 'react'
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  Image, ActivityIndicator, Alert, RefreshControl, Modal, Pressable,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { supabase } from '../src/lib/supabase'
import { useColors } from '../src/hooks/useColors'

interface PendingReview {
  id: string
  user_id: string
  rating: number
  text: string | null
  drink_name: string | null
  photo_url: string | null
  status: string
  created_at: string
  shops?: { name: string } | null
  report_count?: number
}

export default function AdminReviewsScreen() {
  const c = useColors()
  const [reviews, setReviews] = useState<PendingReview[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [zoomPhoto, setZoomPhoto] = useState<string | null>(null)

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from('reviews')
      .select('id, user_id, rating, text, drink_name, photo_url, status, created_at, shops(name)')
      .eq('status', 'pending')
      .order('created_at', { ascending: false })

    if (error) {
      console.error('[Admin] fetch failed:', error.message)
      setReviews([])
    } else {
      setReviews((data ?? []) as unknown as PendingReview[])
    }
    setLoading(false)
    setRefreshing(false)
  }, [])

  useEffect(() => { load() }, [load])

  async function decide(id: string, status: 'approved' | 'rejected') {
    const { error } = await supabase.from('reviews').update({ status }).eq('id', id)
    if (error) {
      Alert.alert('Error', error.message)
      return
    }
    setReviews(r => r.filter(x => x.id !== id))
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: c.background }]} edges={['top']}>
      <View style={[styles.header, { borderBottomColor: c.borderSubtle }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.6}>
          <Ionicons name="chevron-back" size={24} color={c.primaryText} />
        </TouchableOpacity>
        <View>
          <Text style={[styles.title, { color: c.primaryText }]}>Review Queue</Text>
          <Text style={[styles.subtitle, { color: c.secondaryText }]}>
            {reviews.length} pending
          </Text>
        </View>
        <View style={styles.backBtn} />
      </View>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={c.primaryText} />
      ) : (
        <FlatList
          data={reviews}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => { setRefreshing(true); load() }}
              tintColor={c.primaryText}
            />
          }
          ListEmptyComponent={
            <Text style={[styles.empty, { color: c.placeholder }]}>
              Nothing to review 🎉
            </Text>
          }
          renderItem={({ item }) => (
            <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]}>
              {item.photo_url ? (
                <TouchableOpacity onPress={() => setZoomPhoto(item.photo_url)} activeOpacity={0.85}>
                  <Image source={{ uri: item.photo_url }} style={styles.photo} />
                  <View style={styles.photoZoomHint}>
                    <Ionicons name="expand-outline" size={14} color="#FFFFFF" />
                  </View>
                </TouchableOpacity>
              ) : (
                <View style={[styles.noPhoto, { backgroundColor: c.surfaceAlt }]}>
                  <Ionicons name="image-outline" size={28} color={c.placeholder} />
                  <Text style={[styles.noPhotoLabel, { color: c.placeholder }]}>No photo</Text>
                </View>
              )}

              <View style={styles.cardBody}>
                <View style={styles.row}>
                  <View style={styles.stars}>
                    {[1, 2, 3, 4, 5].map(n => (
                      <Ionicons
                        key={n}
                        name={n <= item.rating ? 'star' : 'star-outline'}
                        size={14}
                        color={n <= item.rating ? c.star : c.border}
                      />
                    ))}
                  </View>
                  {item.drink_name && (
                    <Text style={[styles.drink, { color: c.tertiaryText }]}>{item.drink_name}</Text>
                  )}
                </View>

                {item.shops?.name && (
                  <Text style={[styles.shopName, { color: c.secondaryText }]}>
                    {item.shops.name}
                  </Text>
                )}

                {item.text && (
                  <Text style={[styles.text, { color: c.primaryText }]}>{item.text}</Text>
                )}

                <Text style={[styles.meta, { color: c.placeholder }]}>
                  {new Date(item.created_at).toLocaleString()}
                </Text>

                <View style={styles.actions}>
                  <TouchableOpacity
                    style={[styles.rejectBtn, { borderColor: c.error }]}
                    onPress={() => decide(item.id, 'rejected')}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.rejectLabel, { color: c.error }]}>Reject</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.approveBtn, { backgroundColor: c.accent }]}
                    onPress={() => decide(item.id, 'approved')}
                    activeOpacity={0.85}
                  >
                    <Text style={[styles.approveLabel, { color: c.accentText }]}>Approve</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          )}
        />
      )}

      <Modal visible={!!zoomPhoto} transparent animationType="fade" onRequestClose={() => setZoomPhoto(null)}>
        <Pressable style={styles.zoomBackdrop} onPress={() => setZoomPhoto(null)}>
          {zoomPhoto && (
            <Image source={{ uri: zoomPhoto }} style={styles.zoomImage} resizeMode="contain" />
          )}
          <TouchableOpacity style={styles.zoomClose} onPress={() => setZoomPhoto(null)} hitSlop={12}>
            <Ionicons name="close" size={28} color="#FFFFFF" />
          </TouchableOpacity>
        </Pressable>
      </Modal>
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
  title: { fontSize: 17, fontWeight: '700', textAlign: 'center' },
  subtitle: { fontSize: 12, textAlign: 'center', marginTop: 2 },
  list: { padding: 16, paddingBottom: 40, gap: 14 },
  empty: { textAlign: 'center', marginTop: 60, fontSize: 14 },
  card: {
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
  },
  photo: {
    width: '100%',
    aspectRatio: 1,
  },
  photoZoomHint: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  noPhoto: {
    width: '100%',
    aspectRatio: 2.5,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  noPhotoLabel: {
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  zoomBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.95)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  zoomImage: {
    width: '100%',
    height: '100%',
  },
  zoomClose: {
    position: 'absolute',
    top: 56,
    right: 20,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardBody: {
    padding: 14,
    gap: 6,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  stars: { flexDirection: 'row', gap: 2 },
  drink: { fontSize: 12, fontWeight: '500' },
  shopName: { fontSize: 13, fontWeight: '500' },
  text: { fontSize: 14, lineHeight: 19, marginTop: 4 },
  meta: { fontSize: 11, marginTop: 2 },
  actions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 12,
  },
  rejectBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1.5,
    alignItems: 'center',
  },
  rejectLabel: { fontSize: 14, fontWeight: '600' },
  approveBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  approveLabel: { fontSize: 14, fontWeight: '600' },
})
