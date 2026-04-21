import { useEffect, useState, useCallback, useRef } from 'react'
import {
  StyleSheet, Text, View, FlatList, TouchableOpacity,
  Image, RefreshControl, ActivityIndicator, Animated, TextInput, Alert,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { supabase } from '../../src/lib/supabase'
import { useAuthStore } from '../../src/stores/authStore'
import { useColors } from '../../src/hooks/useColors'
import type { ColorPalette } from '../../src/lib/colors'

type FeedMode = 'friends' | 'public'

const SEG_PADDING = 4
const SEG_GAP = 4

interface FeedReview {
  id: string
  user_id: string
  rating: number
  text: string | null
  drink_name: string | null
  photo_url: string | null
  created_at: string
  profiles?: { username: string | null; avatar_url: string | null } | null
  shops?: { name: string } | null
}

interface Comment {
  id: string
  user_id: string
  text: string
  created_at: string
  profiles?: { username: string | null } | null
}

export default function SocialScreen() {
  const user = useAuthStore(s => s.user)
  const c = useColors()
  const [mode, setMode] = useState<FeedMode>('public')
  const [reviews, setReviews] = useState<FeedReview[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [segmentedWidth, setSegmentedWidth] = useState(0)
  const highlightX = useRef(new Animated.Value(mode === 'friends' ? 0 : 1)).current

  const pillWidth = segmentedWidth > 0 ? (segmentedWidth - SEG_PADDING * 2 - SEG_GAP) / 2 : 0

  useEffect(() => {
    Animated.spring(highlightX, {
      toValue: mode === 'friends' ? 0 : 1,
      useNativeDriver: true,
      friction: 11,
      tension: 120,
    }).start()
  }, [mode])

  const load = useCallback(async () => {
    let q = supabase
      .from('reviews')
      .select('id, user_id, rating, text, drink_name, photo_url, created_at, profiles(username, avatar_url), shops(name)')
      .eq('status', 'approved')
      .order('created_at', { ascending: false })
      .limit(50)

    if (mode === 'friends' && user?.id) {
      const { data: follows } = await supabase
        .from('follows')
        .select('following_id')
        .eq('follower_id', user.id)
      const ids = (follows ?? []).map((f: any) => f.following_id)
      if (ids.length === 0) {
        setReviews([])
        setLoading(false)
        setRefreshing(false)
        return
      }
      q = q.in('user_id', ids)
    }

    const { data, error } = await q
    if (error) {
      console.error('[Social] fetch failed:', error.message)
      setReviews([])
    } else {
      setReviews((data ?? []) as unknown as FeedReview[])
    }
    setLoading(false)
    setRefreshing(false)
  }, [mode, user?.id])

  useEffect(() => {
    setLoading(true)
    load()
  }, [load])

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: c.background }]} edges={['top']}>
      <View
        style={[styles.segmented, { backgroundColor: c.surface, borderColor: c.border }]}
        onLayout={e => setSegmentedWidth(e.nativeEvent.layout.width)}
      >
        {pillWidth > 0 && (
          <Animated.View
            pointerEvents="none"
            style={[
              styles.segmentHighlight,
              {
                width: pillWidth,
                backgroundColor: c.accent,
                transform: [{
                  translateX: highlightX.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, pillWidth + SEG_GAP],
                  }),
                }],
              },
            ]}
          />
        )}
        <TouchableOpacity
          style={styles.segment}
          onPress={() => setMode('friends')}
          activeOpacity={0.85}
        >
          <Text style={[
            styles.segmentLabel,
            { color: mode === 'friends' ? c.accentText : c.secondaryText },
          ]}>
            Friends
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.segment}
          onPress={() => setMode('public')}
          activeOpacity={0.85}
        >
          <Text style={[
            styles.segmentLabel,
            { color: mode === 'public' ? c.accentText : c.secondaryText },
          ]}>
            Public
          </Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={c.primaryText} />
      ) : (
        <FlatList
          data={reviews}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => { setRefreshing(true); load() }}
              tintColor={c.primaryText}
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <Ionicons
                name={mode === 'friends' ? 'people-outline' : 'cafe-outline'}
                size={40}
                color={c.placeholder}
              />
              <Text style={[styles.emptyText, { color: c.secondaryText }]}>
                {mode === 'friends'
                  ? 'No friend reviews yet'
                  : 'No reviews yet'}
              </Text>
              <Text style={[styles.emptySub, { color: c.placeholder }]}>
                {mode === 'friends'
                  ? 'Follow people from your Profile to see their reviews here.'
                  : 'Be the first to post a boba review.'}
              </Text>
            </View>
          }
          renderItem={({ item }) => <FeedCard review={item} c={c} currentUserId={user?.id ?? null} />}
        />
      )}
    </SafeAreaView>
  )
}

function FeedCard({ review, c, currentUserId }: {
  review: FeedReview
  c: ColorPalette
  currentUserId: string | null
}) {
  const username = review.profiles?.username ?? 'anonymous'
  const avatarUrl = review.profiles?.avatar_url ?? null
  const [expanded, setExpanded] = useState(false)
  const [comments, setComments] = useState<Comment[]>([])
  const [commentCount, setCommentCount] = useState<number>(0)
  const [loadingComments, setLoadingComments] = useState(false)
  const [draft, setDraft] = useState('')
  const [posting, setPosting] = useState(false)

  useEffect(() => {
    supabase
      .from('review_comments')
      .select('id', { count: 'exact', head: true })
      .eq('review_id', review.id)
      .then(({ count }) => setCommentCount(count ?? 0))
  }, [review.id])

  async function loadComments() {
    setLoadingComments(true)
    const { data, error } = await supabase
      .from('review_comments')
      .select('id, user_id, text, created_at, profiles(username)')
      .eq('review_id', review.id)
      .order('created_at', { ascending: true })
    if (error) console.error('[Social] comments fetch failed:', error.message)
    setComments((data ?? []) as unknown as Comment[])
    setLoadingComments(false)
  }

  function toggleExpanded() {
    if (!expanded) loadComments()
    setExpanded(!expanded)
  }

  async function postComment() {
    const text = draft.trim()
    if (!text || !currentUserId) return
    setPosting(true)
    const { data, error } = await supabase
      .from('review_comments')
      .insert({ review_id: review.id, user_id: currentUserId, text })
      .select('id, user_id, text, created_at, profiles(username)')
      .single()
    setPosting(false)
    if (error || !data) {
      Alert.alert('Could not post', error?.message ?? 'Unknown error')
      return
    }
    setComments(prev => [...prev, data as unknown as Comment])
    setCommentCount(n => n + 1)
    setDraft('')
  }

  async function deleteComment(id: string) {
    const { error } = await supabase.from('review_comments').delete().eq('id', id)
    if (error) {
      Alert.alert('Could not delete', error.message)
      return
    }
    setComments(prev => prev.filter(x => x.id !== id))
    setCommentCount(n => Math.max(0, n - 1))
  }

  return (
    <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]}>
      <View style={styles.cardHeader}>
        <View style={[styles.avatar, { backgroundColor: c.accent }]}>
          {avatarUrl ? (
            <Image source={{ uri: avatarUrl }} style={styles.avatarImage} />
          ) : (
            <Text style={[styles.avatarText, { color: c.accentText }]}>
              {username[0]?.toUpperCase() ?? '?'}
            </Text>
          )}
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.cardUsername, { color: c.primaryText }]}>
            @{username}
          </Text>
          <Text style={[styles.cardShop, { color: c.secondaryText }]} numberOfLines={1}>
            at {review.shops?.name ?? 'Unknown shop'}
          </Text>
        </View>
        <Text style={[styles.cardDate, { color: c.placeholder }]}>
          {timeAgo(review.created_at)}
        </Text>
      </View>

      {review.photo_url && (
        <Image source={{ uri: review.photo_url }} style={styles.cardPhoto} />
      )}

      <View style={styles.cardBody}>
        <View style={styles.starsRow}>
          {[1, 2, 3, 4, 5].map(n => (
            <Ionicons
              key={n}
              name={n <= review.rating ? 'star' : 'star-outline'}
              size={14}
              color={n <= review.rating ? c.star : c.border}
            />
          ))}
          {review.drink_name && (
            <Text style={[styles.cardDrink, { color: c.tertiaryText }]}>
              · {review.drink_name}
            </Text>
          )}
        </View>
        {review.text && (
          <Text style={[styles.cardText, { color: c.primaryText }]}>
            {review.text}
          </Text>
        )}
      </View>

      <TouchableOpacity
        style={[styles.commentToggle, { borderTopColor: c.borderSubtle }]}
        onPress={toggleExpanded}
        activeOpacity={0.7}
      >
        <Ionicons
          name={expanded ? 'chatbubble' : 'chatbubble-outline'}
          size={15}
          color={c.secondaryText}
        />
        <Text style={[styles.commentToggleLabel, { color: c.secondaryText }]}>
          {commentCount === 0
            ? 'Add a comment'
            : commentCount === 1
              ? '1 comment'
              : `${commentCount} comments`}
        </Text>
      </TouchableOpacity>

      {expanded && (
        <View style={[styles.commentsSection, { borderTopColor: c.borderSubtle }]}>
          {loadingComments ? (
            <ActivityIndicator size="small" color={c.secondaryText} style={{ paddingVertical: 12 }} />
          ) : comments.length === 0 ? (
            <Text style={[styles.commentEmpty, { color: c.placeholder }]}>
              Be the first to comment.
            </Text>
          ) : (
            comments.map(co => (
              <View key={co.id} style={styles.commentRow}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.commentHeader, { color: c.secondaryText }]}>
                    <Text style={{ color: c.primaryText, fontWeight: '600' }}>
                      @{co.profiles?.username ?? 'anonymous'}
                    </Text>
                    {'  '}
                    <Text style={{ color: c.placeholder }}>{timeAgo(co.created_at)}</Text>
                  </Text>
                  <Text style={[styles.commentText, { color: c.primaryText }]}>
                    {co.text}
                  </Text>
                </View>
                {currentUserId === co.user_id && (
                  <TouchableOpacity onPress={() => deleteComment(co.id)} hitSlop={8}>
                    <Ionicons name="trash-outline" size={14} color={c.placeholder} />
                  </TouchableOpacity>
                )}
              </View>
            ))
          )}

          {currentUserId ? (
            <View style={[styles.composerRow, { borderTopColor: c.borderSubtle }]}>
              <TextInput
                style={[styles.composerInput, { backgroundColor: c.background, color: c.primaryText, borderColor: c.border }]}
                placeholder="Add a comment..."
                placeholderTextColor={c.placeholder}
                value={draft}
                onChangeText={setDraft}
                multiline
                maxLength={500}
                editable={!posting}
              />
              <TouchableOpacity
                onPress={postComment}
                disabled={!draft.trim() || posting}
                style={[
                  styles.composerSend,
                  { backgroundColor: draft.trim() && !posting ? c.accent : c.border },
                ]}
                activeOpacity={0.85}
              >
                {posting
                  ? <ActivityIndicator size="small" color={c.accentText} />
                  : <Ionicons name="arrow-up" size={16} color={c.accentText} />
                }
              </TouchableOpacity>
            </View>
          ) : (
            <Text style={[styles.commentEmpty, { color: c.placeholder }]}>
              Sign in to comment.
            </Text>
          )}
        </View>
      )}
    </View>
  )
}

function timeAgo(iso: string): string {
  const now = Date.now()
  const then = new Date(iso).getTime()
  const s = Math.max(0, Math.floor((now - then) / 1000))
  if (s < 60) return 'just now'
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h`
  const d = Math.floor(h / 24)
  if (d < 7) return `${d}d`
  const w = Math.floor(d / 7)
  if (w < 5) return `${w}w`
  return new Date(iso).toLocaleDateString()
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

  segmented: {
    flexDirection: 'row',
    margin: 16,
    padding: SEG_PADDING,
    borderRadius: 12,
    borderWidth: 1,
    gap: SEG_GAP,
    position: 'relative',
  },
  segmentHighlight: {
    position: 'absolute',
    top: SEG_PADDING,
    bottom: SEG_PADDING,
    left: SEG_PADDING,
    borderRadius: 8,
  },
  segment: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: 8,
    alignItems: 'center',
    zIndex: 1,
  },
  segmentLabel: { fontSize: 13, fontWeight: '600' },

  list: { paddingBottom: 40, gap: 18 },

  emptyWrap: {
    alignItems: 'center',
    paddingTop: 60,
    paddingHorizontal: 20,
    gap: 8,
  },
  emptyText: { fontSize: 16, fontWeight: '600' },
  emptySub: { fontSize: 13, textAlign: 'center' },

  card: {
    overflow: 'hidden',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 10,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImage: { width: 36, height: 36, borderRadius: 18 },
  avatarText: { fontSize: 16, fontWeight: '700' },
  cardUsername: { fontSize: 14, fontWeight: '600' },
  cardShop: { fontSize: 12, marginTop: 1 },
  cardDate: { fontSize: 11 },
  cardPhoto: {
    width: '100%',
    aspectRatio: 4 / 5,
  },
  cardBody: { paddingHorizontal: 14, paddingTop: 10, paddingBottom: 6, gap: 6 },
  starsRow: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  cardDrink: { fontSize: 12, marginLeft: 4 },
  cardText: { fontSize: 13, lineHeight: 19, marginTop: 2 },

  commentToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  commentToggleLabel: { fontSize: 12, fontWeight: '500' },

  commentsSection: {
    borderTopWidth: 1,
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 10,
    gap: 10,
  },
  commentRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  commentHeader: { fontSize: 11 },
  commentText: { fontSize: 13, lineHeight: 18, marginTop: 2 },
  commentEmpty: { fontSize: 12, textAlign: 'center', paddingVertical: 8 },

  composerRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    paddingTop: 10,
    borderTopWidth: 1,
  },
  composerInput: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 18,
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 8,
    fontSize: 13,
    maxHeight: 100,
  },
  composerSend: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
})
