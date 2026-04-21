import { useEffect, useState, useRef } from 'react'
import {
  StyleSheet, Text, View, TouchableOpacity, Alert, ScrollView, Image,
  ActivityIndicator, Modal, Pressable, Animated, Dimensions, Easing,
  FlatList, TextInput,
} from 'react-native'
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { router } from 'expo-router'
import * as ImagePicker from 'expo-image-picker'
import * as FileSystem from 'expo-file-system/legacy'
import { decode as decodeBase64 } from 'base64-arraybuffer'
import { supabase } from '../../src/lib/supabase'
import { useAuthStore } from '../../src/stores/authStore'
import { useColors } from '../../src/hooks/useColors'
import type { ColorPalette } from '../../src/lib/colors'

const SCREEN_WIDTH = Dimensions.get('window').width
const DRAWER_WIDTH = Math.min(SCREEN_WIDTH * 0.80, 340)
const GRID_GAP = 2
const GRID_COLS = 3
const GRID_CELL = (SCREEN_WIDTH - GRID_GAP * (GRID_COLS - 1)) / GRID_COLS

interface UserReview {
  id: string
  rating: number
  text: string | null
  drink_name: string | null
  photo_url: string | null
  status: string
  created_at: string
  shops?: { name: string } | null
}

interface Stats {
  reviewCount: number
  avgRating: number
  favoriteShop: string | null
}

interface Friend {
  id: string
  username: string | null
  avatar_url: string | null
}

export default function ProfileScreen() {
  const user = useAuthStore(s => s.user)
  const profile = useAuthStore(s => s.profile)
  const isGuest = useAuthStore(s => s.isGuest)
  const reset = useAuthStore(s => s.reset)
  const setSession = useAuthStore(s => s.setSession)
  const c = useColors()
  const insets = useSafeAreaInsets()

  const [reviews, setReviews] = useState<UserReview[]>([])
  const [stats, setStats] = useState<Stats>({ reviewCount: 0, avgRating: 0, favoriteShop: null })
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [drawerMounted, setDrawerMounted] = useState(false)
  const [selectedReview, setSelectedReview] = useState<UserReview | null>(null)
  const [friends, setFriends] = useState<Friend[]>([])
  const [followerCount, setFollowerCount] = useState(0)
  const [findFriendsOpen, setFindFriendsOpen] = useState(false)
  const [friendSearch, setFriendSearch] = useState('')
  const [searchResults, setSearchResults] = useState<Friend[]>([])

  const translateX = useRef(new Animated.Value(DRAWER_WIDTH)).current
  const backdropOpacity = useRef(new Animated.Value(0)).current

  const avatarUrl = (user?.user_metadata as any)?.avatar_url as string | undefined
  const isAdmin = (user?.app_metadata as any)?.is_admin === true

  useEffect(() => {
    if (!user?.id) return
    let cancelled = false
    ;(async () => {
      const { data, error } = await supabase
        .from('reviews')
        .select('id, rating, text, drink_name, photo_url, status, created_at, shops(name)')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
      if (cancelled) return
      if (error) {
        console.error('[Profile] reviews fetch failed:', error.message)
        return
      }
      const items = (data ?? []) as unknown as UserReview[]
      setReviews(items)

      const reviewCount = items.length
      const avgRating = reviewCount
        ? items.reduce((s, r) => s + (r.rating ?? 0), 0) / reviewCount
        : 0
      const shopCounts: Record<string, number> = {}
      items.forEach(r => {
        const name = r.shops?.name
        if (name) shopCounts[name] = (shopCounts[name] ?? 0) + 1
      })
      const favoriteShop = Object.entries(shopCounts)
        .sort((a, b) => b[1] - a[1])[0]?.[0] ?? null
      setStats({ reviewCount, avgRating, favoriteShop })
    })()
    return () => { cancelled = true }
  }, [user?.id])

  // Fetch friends (people I follow) + follower count
  useEffect(() => {
    if (!user?.id) return
    let cancelled = false
    ;(async () => {
      const { data: follows } = await supabase
        .from('follows')
        .select('following_id')
        .eq('follower_id', user.id)
      const ids = (follows ?? []).map((f: any) => f.following_id)
      if (ids.length > 0) {
        const { data: profs } = await supabase
          .from('profiles')
          .select('id, username, avatar_url')
          .in('id', ids)
        if (!cancelled) setFriends((profs ?? []) as Friend[])
      } else if (!cancelled) {
        setFriends([])
      }

      const { count } = await supabase
        .from('follows')
        .select('*', { count: 'exact', head: true })
        .eq('following_id', user.id)
      if (!cancelled) setFollowerCount(count ?? 0)
    })()
    return () => { cancelled = true }
  }, [user?.id])

  async function searchFriends(q: string) {
    setFriendSearch(q)
    if (q.trim().length < 2 || !user) {
      setSearchResults([])
      return
    }
    const { data } = await supabase
      .from('profiles')
      .select('id, username, avatar_url')
      .ilike('username', `%${q}%`)
      .neq('id', user.id)
      .limit(20)
    setSearchResults((data ?? []) as Friend[])
  }

  async function toggleFollow(targetId: string) {
    if (!user) return
    const alreadyFollowing = friends.some(f => f.id === targetId)
    if (alreadyFollowing) {
      const { error } = await supabase
        .from('follows')
        .delete()
        .eq('follower_id', user.id)
        .eq('following_id', targetId)
      if (error) return Alert.alert('Error', error.message)
      setFriends(f => f.filter(x => x.id !== targetId))
    } else {
      const { error } = await supabase
        .from('follows')
        .insert({ follower_id: user.id, following_id: targetId })
      if (error) return Alert.alert('Error', error.message)
      const target = searchResults.find(r => r.id === targetId)
      if (target) setFriends(f => [...f, target])
    }
  }

  // Drawer animation
  useEffect(() => {
    if (drawerOpen) {
      setDrawerMounted(true)
      Animated.parallel([
        Animated.timing(translateX, {
          toValue: 0, duration: 180, easing: Easing.out(Easing.quad), useNativeDriver: true,
        }),
        Animated.timing(backdropOpacity, { toValue: 1, duration: 180, useNativeDriver: true }),
      ]).start()
    } else if (drawerMounted) {
      Animated.parallel([
        Animated.timing(translateX, {
          toValue: DRAWER_WIDTH, duration: 150, easing: Easing.in(Easing.quad), useNativeDriver: true,
        }),
        Animated.timing(backdropOpacity, { toValue: 0, duration: 150, useNativeDriver: true }),
      ]).start(() => setDrawerMounted(false))
    }
  }, [drawerOpen])

  async function handleChangeAvatar() {
    if (isGuest || !user) {
      Alert.alert('Sign in required', 'Create an account to set a profile picture.')
      return
    }
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Allow photo access to change your picture.')
      return
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    })
    if (result.canceled || !result.assets[0]) return

    try {
      setUploadingAvatar(true)
      const uri = result.assets[0].uri
      const ext = uri.split('.').pop()?.toLowerCase() || 'jpg'
      const path = `${user.id}/avatar_${Date.now()}.${ext}`

      const base64 = await FileSystem.readAsStringAsync(uri, {
        encoding: FileSystem.EncodingType.Base64,
      })
      const arrayBuffer = decodeBase64(base64)

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(path, arrayBuffer, {
          contentType: `image/${ext === 'jpg' ? 'jpeg' : ext}`,
          upsert: true,
        })
      if (uploadError) throw uploadError

      const { data: publicData } = supabase.storage.from('avatars').getPublicUrl(path)
      const publicUrl = publicData.publicUrl

      const { error: updateError } = await supabase.auth.updateUser({
        data: { avatar_url: publicUrl },
      })
      if (updateError) throw updateError

      const { data: sessionData } = await supabase.auth.getSession()
      setSession(sessionData.session)
    } catch (e: any) {
      Alert.alert('Upload failed', e.message)
    } finally {
      setUploadingAvatar(false)
    }
  }

  function handleDeleteReview(review: UserReview) {
    Alert.alert(
      'Delete review',
      'This will remove it from your profile and the shop. This can\'t be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            const { error } = await supabase
              .from('reviews')
              .delete()
              .eq('id', review.id)
            if (error) {
              Alert.alert('Error', error.message)
              return
            }
            setReviews(r => r.filter(x => x.id !== review.id))
            setStats(s => {
              const newCount = Math.max(0, s.reviewCount - 1)
              return {
                reviewCount: newCount,
                avgRating: newCount === 0
                  ? 0
                  : ((s.avgRating * s.reviewCount) - review.rating) / newCount,
                favoriteShop: s.favoriteShop,
              }
            })
            setSelectedReview(null)
          },
        },
      ]
    )
  }

  function handleSignOut() {
    Alert.alert('Sign out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign out',
        style: 'destructive',
        onPress: async () => {
          setDrawerOpen(false)
          reset()
          await supabase.auth.signOut()
        },
      },
    ])
  }

  function comingSoon(feature: string) {
    Alert.alert(feature, 'Coming soon.')
  }

  function openSetting(route: string) {
    setDrawerOpen(false)
    setTimeout(() => router.push(route as any), 200)
  }

  const memberSince = user?.created_at
    ? new Date(user.created_at).toLocaleDateString(undefined, { month: 'short', year: 'numeric' })
    : null

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: c.background }]} edges={['top']}>
      <View style={[styles.header, { borderBottomColor: c.borderSubtle }]}>
        <Text style={[styles.title, { color: c.primaryText }]}>Profile</Text>
        <TouchableOpacity
          onPress={() => setDrawerOpen(true)}
          style={styles.hamburger}
          activeOpacity={0.6}
        >
          <Ionicons name="menu" size={24} color={c.primaryText} />
        </TouchableOpacity>
      </View>

      <FlatList
        data={reviews}
        keyExtractor={item => item.id}
        numColumns={GRID_COLS}
        contentContainerStyle={styles.scroll}
        columnWrapperStyle={reviews.length > 0 ? styles.gridRow : undefined}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <View style={styles.headerWrap}>
            <View style={styles.identityCard}>
              <TouchableOpacity
                onPress={handleChangeAvatar}
                activeOpacity={0.8}
                disabled={uploadingAvatar}
                style={styles.avatarWrap}
              >
                <View style={[styles.avatar, { backgroundColor: c.accent }]}>
                  {avatarUrl ? (
                    <Image source={{ uri: avatarUrl }} style={styles.avatarImage} />
                  ) : (
                    <Text style={[styles.avatarText, { color: c.accentText }]}>
                      {isGuest
                        ? '?'
                        : (profile?.username?.[0]?.toUpperCase() ?? user?.email?.[0]?.toUpperCase() ?? '?')}
                    </Text>
                  )}
                  {uploadingAvatar && (
                    <View style={styles.avatarOverlay}>
                      <ActivityIndicator color="#FFFFFF" />
                    </View>
                  )}
                </View>
                {!isGuest && !uploadingAvatar && (
                  <View style={[styles.avatarBadge, { backgroundColor: c.accent, borderColor: c.background }]}>
                    <Ionicons name="camera" size={14} color={c.accentText} />
                  </View>
                )}
              </TouchableOpacity>
              <Text style={[styles.name, { color: c.primaryText }]}>
                {isGuest
                  ? 'Guest'
                  : profile?.username
                    ? `@${profile.username}`
                    : user?.email}
              </Text>
              <Text style={[styles.subtitle, { color: c.secondaryText }]}>
                {isGuest
                  ? 'Sign in to save your ratings'
                  : profile?.username && user?.email
                    ? user.email
                    : memberSince
                      ? `Member since ${memberSince}`
                      : 'Member'}
              </Text>
            </View>

            {!isGuest && (
              <View style={styles.statsRow}>
                <StatBox c={c} value={String(stats.reviewCount)} label="Reviews" />
                <StatBox c={c} value={String(friends.length)} label="Following" />
                <StatBox c={c} value={String(followerCount)} label="Followers" />
              </View>
            )}

            {!isGuest && (
              <View style={styles.friendsBlock}>
                <View style={styles.friendsHeader}>
                  <Text style={[styles.sectionLabel, { color: c.placeholder }]}>Friends</Text>
                  <TouchableOpacity onPress={() => setFindFriendsOpen(true)} activeOpacity={0.6}>
                    <Text style={[styles.findFriendsLink, { color: c.accent }]}>
                      + Find friends
                    </Text>
                  </TouchableOpacity>
                </View>
                {friends.length === 0 ? (
                  <Text style={[styles.emptyFriends, { color: c.placeholder }]}>
                    You're not following anyone yet.
                  </Text>
                ) : (
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.friendsRow}
                  >
                    {friends.map(f => (
                      <View key={f.id} style={styles.friendItem}>
                        <View style={[styles.friendAvatar, { backgroundColor: c.accent }]}>
                          {f.avatar_url ? (
                            <Image source={{ uri: f.avatar_url }} style={styles.friendAvatarImage} />
                          ) : (
                            <Text style={[styles.friendAvatarText, { color: c.accentText }]}>
                              {(f.username ?? '?')[0].toUpperCase()}
                            </Text>
                          )}
                        </View>
                        <Text
                          style={[styles.friendName, { color: c.primaryText }]}
                          numberOfLines={1}
                        >
                          @{f.username}
                        </Text>
                      </View>
                    ))}
                  </ScrollView>
                )}
              </View>
            )}

            {!isGuest && reviews.length > 0 && (
              <Text style={[styles.sectionLabel, { color: c.placeholder }]}>Your reviews</Text>
            )}
          </View>
        }
        ListEmptyComponent={
          !isGuest ? (
            <View style={styles.emptyWrap}>
              <Ionicons name="star-outline" size={40} color={c.placeholder} />
              <Text style={[styles.emptyText, { color: c.secondaryText }]}>No reviews yet</Text>
              <Text style={[styles.emptySub, { color: c.placeholder }]}>
                Snap a drink in the Camera tab to log your first review
              </Text>
            </View>
          ) : null
        }
        renderItem={({ item }) => (
          <GridCell review={item} c={c} onPress={() => setSelectedReview(item)} />
        )}
      />

      <Modal
        visible={drawerMounted}
        transparent
        animationType="none"
        statusBarTranslucent
        onRequestClose={() => setDrawerOpen(false)}
      >
        <Animated.View style={[styles.backdrop, { opacity: backdropOpacity }]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setDrawerOpen(false)} />
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
            <Text style={[styles.drawerTitle, { color: c.primaryText }]}>Settings</Text>
            <TouchableOpacity
              style={[styles.drawerClose, { backgroundColor: c.surface }]}
              onPress={() => setDrawerOpen(false)}
              activeOpacity={0.6}
            >
              <Ionicons name="close" size={18} color={c.primaryText} />
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={styles.drawerContent} showsVerticalScrollIndicator={false}>
            <Text style={[styles.drawerSection, { color: c.placeholder }]}>Account</Text>
            <View style={[styles.group, { backgroundColor: c.surface, borderColor: c.border }]}>
              <SettingRow c={c} icon="person-circle-outline" label="Edit profile" onPress={() => comingSoon('Edit profile')} />
              <Divider c={c} />
              <SettingRow c={c} icon="heart-outline" label="Favorites" onPress={() => comingSoon('Favorites')} />
              <Divider c={c} />
              <SettingRow c={c} icon="trophy-outline" label="Achievements" onPress={() => comingSoon('Achievements')} />
            </View>

            <Text style={[styles.drawerSection, { color: c.placeholder }]}>Preferences</Text>
            <View style={[styles.group, { backgroundColor: c.surface, borderColor: c.border }]}>
              <SettingRow c={c} icon="notifications-outline" label="Notifications" onPress={() => comingSoon('Notifications')} />
              <Divider c={c} />
              <SettingRow c={c} icon="cafe-outline" label="Favorite drink" onPress={() => comingSoon('Favorite drink')} />
              <Divider c={c} />
              <SettingRow c={c} icon="color-palette-outline" label="Appearance" onPress={() => openSetting('/appearance')} />
            </View>

            {isAdmin && (
              <>
                <Text style={[styles.drawerSection, { color: c.placeholder }]}>Admin</Text>
                <View style={[styles.group, { backgroundColor: c.surface, borderColor: c.border }]}>
                  <SettingRow c={c} icon="shield-checkmark-outline" label="Review queue" onPress={() => openSetting('/admin-reviews')} />
                </View>
              </>
            )}

            <Text style={[styles.drawerSection, { color: c.placeholder }]}>About</Text>
            <View style={[styles.group, { backgroundColor: c.surface, borderColor: c.border }]}>
              <SettingRow c={c} icon="help-circle-outline" label="Help & feedback" onPress={() => comingSoon('Help')} />
              <Divider c={c} />
              <SettingRow c={c} icon="document-text-outline" label="Terms & privacy" onPress={() => comingSoon('Terms')} />
              <Divider c={c} />
              <SettingRow c={c} icon="information-circle-outline" label="Version" value="1.0.0" />
            </View>

            <TouchableOpacity
              style={[styles.signOutButton, { borderColor: c.error }]}
              onPress={handleSignOut}
              activeOpacity={0.8}
            >
              <Text style={[styles.signOutLabel, { color: c.error }]}>Sign out</Text>
            </TouchableOpacity>
          </ScrollView>
        </Animated.View>
      </Modal>

      {selectedReview && (
        <ReviewDetailModal
          review={selectedReview}
          onClose={() => setSelectedReview(null)}
          onDelete={() => handleDeleteReview(selectedReview)}
          c={c}
        />
      )}

      <Modal
        visible={findFriendsOpen}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setFindFriendsOpen(false)}
      >
        <SafeAreaView style={[{ flex: 1, backgroundColor: c.background }]}>
          <View style={[styles.ffHeader, { borderBottomColor: c.borderSubtle }]}>
            <Text style={[styles.ffTitle, { color: c.primaryText }]}>Find friends</Text>
            <TouchableOpacity
              onPress={() => { setFindFriendsOpen(false); setFriendSearch(''); setSearchResults([]) }}
            >
              <Ionicons name="close" size={24} color={c.primaryText} />
            </TouchableOpacity>
          </View>
          <View style={[styles.ffSearchWrap, { backgroundColor: c.surface, borderColor: c.border }]}>
            <Ionicons name="search" size={16} color={c.placeholder} />
            <TextInput
              style={[styles.ffSearchInput, { color: c.primaryText }]}
              placeholder="Search by username..."
              placeholderTextColor={c.placeholder}
              value={friendSearch}
              onChangeText={searchFriends}
              autoFocus
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>
          <FlatList
            data={searchResults}
            keyExtractor={item => item.id}
            contentContainerStyle={{ padding: 16, gap: 8 }}
            ListEmptyComponent={
              <Text style={[styles.ffEmpty, { color: c.placeholder }]}>
                {friendSearch.trim().length < 2
                  ? 'Type at least 2 characters'
                  : 'No users found'}
              </Text>
            }
            renderItem={({ item }) => {
              const isFollowing = friends.some(f => f.id === item.id)
              return (
                <View style={[styles.ffRow, { backgroundColor: c.surface, borderColor: c.border }]}>
                  <View style={[styles.friendAvatar, { backgroundColor: c.accent, width: 40, height: 40, borderRadius: 20 }]}>
                    {item.avatar_url ? (
                      <Image source={{ uri: item.avatar_url }} style={{ width: 40, height: 40, borderRadius: 20 }} />
                    ) : (
                      <Text style={[styles.friendAvatarText, { color: c.accentText }]}>
                        {(item.username ?? '?')[0].toUpperCase()}
                      </Text>
                    )}
                  </View>
                  <Text style={[styles.ffRowName, { color: c.primaryText }]} numberOfLines={1}>
                    @{item.username}
                  </Text>
                  <TouchableOpacity
                    style={[
                      styles.ffFollowBtn,
                      isFollowing
                        ? { backgroundColor: c.surfaceAlt, borderColor: c.border }
                        : { backgroundColor: c.accent, borderColor: c.accent },
                    ]}
                    onPress={() => toggleFollow(item.id)}
                    activeOpacity={0.85}
                  >
                    <Text style={[
                      styles.ffFollowLabel,
                      { color: isFollowing ? c.secondaryText : c.accentText },
                    ]}>
                      {isFollowing ? 'Following' : 'Follow'}
                    </Text>
                  </TouchableOpacity>
                </View>
              )
            }}
          />
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  )
}

function GridCell({ review, c, onPress }: {
  review: UserReview
  c: ColorPalette
  onPress: () => void
}) {
  return (
    <TouchableOpacity
      style={[styles.gridCell, { backgroundColor: c.surface }]}
      onPress={onPress}
      activeOpacity={0.8}
    >
      {review.photo_url ? (
        <Image source={{ uri: review.photo_url }} style={styles.gridImage} />
      ) : (
        <View style={[styles.gridFallback, { backgroundColor: c.surface }]}>
          <Ionicons name="star" size={20} color={c.star} />
          <Text style={[styles.gridFallbackText, { color: c.primaryText }]}>
            {review.rating}
          </Text>
        </View>
      )}
      <View style={styles.gridBottomOverlay}>
        <Ionicons name="star" size={10} color="#FFFFFF" />
        <Text style={styles.gridBottomText}>{review.rating}</Text>
      </View>
    </TouchableOpacity>
  )
}

function ReviewDetailModal({ review, onClose, onDelete, c }: {
  review: UserReview
  onClose: () => void
  onDelete: () => void
  c: ColorPalette
}) {
  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.detailBackdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={[styles.detailCard, { backgroundColor: c.surface, borderColor: c.border }]}>
          <TouchableOpacity style={styles.detailClose} onPress={onClose} hitSlop={8}>
            <Ionicons name="close" size={22} color="#FFFFFF" />
          </TouchableOpacity>
          {review.photo_url && (
            <Image source={{ uri: review.photo_url }} style={styles.detailPhoto} />
          )}
          <View style={styles.detailBody}>
            <Text style={[styles.detailShop, { color: c.primaryText }]} numberOfLines={1}>
              {review.shops?.name ?? 'Unknown shop'}
            </Text>
            <View style={styles.reviewStars}>
              {[1, 2, 3, 4, 5].map(n => (
                <Ionicons
                  key={n}
                  name={n <= review.rating ? 'star' : 'star-outline'}
                  size={16}
                  color={n <= review.rating ? c.star : c.border}
                />
              ))}
              {review.drink_name && (
                <Text style={[styles.reviewDrink, { color: c.tertiaryText }]}>
                  · {review.drink_name}
                </Text>
              )}
            </View>
            {review.text && (
              <Text style={[styles.reviewText, { color: c.primaryText }]}>
                {review.text}
              </Text>
            )}
            <Text style={[styles.reviewDate, { color: c.placeholder }]}>
              {new Date(review.created_at).toLocaleDateString()}
            </Text>

            <TouchableOpacity
              style={[styles.deleteButton, { borderColor: c.error }]}
              onPress={onDelete}
              activeOpacity={0.8}
            >
              <Ionicons name="trash-outline" size={16} color={c.error} />
              <Text style={[styles.deleteLabel, { color: c.error }]}>Delete review</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  )
}

function StatBox({ c, value, label }: { c: ColorPalette; value: string; label: string }) {
  return (
    <View style={[styles.statBox, { backgroundColor: c.surface, borderColor: c.border }]}>
      <Text style={[styles.statValue, { color: c.primaryText }]} numberOfLines={1}>{value}</Text>
      <Text style={[styles.statLabel, { color: c.secondaryText }]}>{label}</Text>
    </View>
  )
}

function SettingRow({ c, icon, label, value, onPress }: {
  c: ColorPalette
  icon: keyof typeof Ionicons.glyphMap
  label: string
  value?: string
  onPress?: () => void
}) {
  return (
    <TouchableOpacity
      style={styles.settingRow}
      onPress={onPress}
      activeOpacity={onPress ? 0.6 : 1}
      disabled={!onPress}
    >
      <Ionicons name={icon} size={20} color={c.tertiaryText} />
      <Text style={[styles.settingLabel, { color: c.primaryText }]}>{label}</Text>
      {value ? (
        <Text style={[styles.settingValue, { color: c.secondaryText }]}>{value}</Text>
      ) : onPress ? (
        <Ionicons name="chevron-forward" size={16} color={c.placeholder} />
      ) : null}
    </TouchableOpacity>
  )
}

function Divider({ c }: { c: ColorPalette }) {
  return <View style={[styles.divider, { backgroundColor: c.border }]} />
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 14,
    borderBottomWidth: 1,
  },
  title: { fontSize: 20, fontWeight: '700', paddingLeft: 8 },
  hamburger: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scroll: { paddingBottom: 40 },
  headerWrap: { padding: 20, gap: 16 },

  identityCard: {
    alignItems: 'center',
    paddingTop: 6,
    paddingBottom: 6,
  },
  avatarWrap: {
    position: 'relative',
    marginBottom: 14,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImage: { width: 80, height: 80, borderRadius: 40 },
  avatarText: { fontSize: 32, fontWeight: '700' },
  avatarOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 40,
  },
  avatarBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  name: { fontSize: 17, fontWeight: '600', marginBottom: 4 },
  subtitle: { fontSize: 13 },

  statsRow: { flexDirection: 'row', gap: 10 },
  friendsBlock: { gap: 8 },
  friendsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  findFriendsLink: { fontSize: 13, fontWeight: '600' },
  emptyFriends: { fontSize: 13, paddingHorizontal: 4 },
  friendsRow: { gap: 14, paddingVertical: 4 },
  friendItem: { alignItems: 'center', width: 64 },
  friendAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    marginBottom: 6,
  },
  friendAvatarImage: { width: 56, height: 56, borderRadius: 28 },
  friendAvatarText: { fontSize: 20, fontWeight: '700' },
  friendName: { fontSize: 11, textAlign: 'center', maxWidth: 64 },

  ffHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  ffTitle: { fontSize: 18, fontWeight: '700' },
  ffSearchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginTop: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderRadius: 12,
    gap: 8,
  },
  ffSearchInput: { flex: 1, fontSize: 14, padding: 0 },
  ffEmpty: { textAlign: 'center', padding: 40, fontSize: 13 },
  ffRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    gap: 12,
  },
  ffRowName: { flex: 1, fontSize: 15, fontWeight: '500' },
  ffFollowBtn: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 16,
    borderWidth: 1,
  },
  ffFollowLabel: { fontSize: 13, fontWeight: '600' },
  statBox: {
    flex: 1,
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    alignItems: 'center',
    gap: 4,
  },
  statValue: { fontSize: 18, fontWeight: '700' },
  statLabel: { fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5 },

  sectionLabel: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginTop: 6,
    marginLeft: 4,
    marginBottom: -4,
  },

  emptyWrap: {
    alignItems: 'center',
    paddingTop: 60,
    paddingHorizontal: 20,
    gap: 10,
  },
  emptyText: { fontSize: 15, fontWeight: '500' },
  emptySub: { fontSize: 12, textAlign: 'center' },

  gridRow: { gap: GRID_GAP },
  gridCell: {
    width: GRID_CELL,
    height: GRID_CELL,
    position: 'relative',
    overflow: 'hidden',
  },
  gridImage: { width: '100%', height: '100%' },
  gridFallback: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  gridFallbackText: { fontSize: 18, fontWeight: '700' },
  gridStatusBadge: {
    position: 'absolute',
    top: 6,
    left: 6,
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 6,
  },
  gridStatusLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: '#FFFFFF',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  gridBottomOverlay: {
    position: 'absolute',
    bottom: 6,
    right: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    backgroundColor: 'rgba(0,0,0,0.55)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  gridBottomText: { fontSize: 11, fontWeight: '700', color: '#FFFFFF' },

  reviewStars: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginTop: 4,
  },
  reviewDrink: { fontSize: 12, marginLeft: 4 },
  reviewText: { fontSize: 13, lineHeight: 18, marginTop: 6 },
  reviewDate: { fontSize: 11, marginTop: 6 },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  statusLabel: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },

  detailBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  detailCard: {
    width: '100%',
    maxWidth: 400,
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
  },
  detailClose: {
    position: 'absolute',
    top: 12,
    right: 12,
    zIndex: 2,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  detailPhoto: {
    width: '100%',
    aspectRatio: 1,
  },
  detailBody: { padding: 16, gap: 4 },
  detailTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  detailShop: { fontSize: 16, fontWeight: '600', flex: 1 },
  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 11,
    marginTop: 14,
    gap: 6,
  },
  deleteLabel: { fontSize: 14, fontWeight: '600' },

  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  drawer: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    right: 0,
    shadowColor: '#000',
    shadowOffset: { width: -6, height: 0 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 16,
  },
  drawerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 20,
  },
  drawerTitle: { fontSize: 22, fontWeight: '700', letterSpacing: -0.3 },
  drawerClose: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  drawerContent: { paddingHorizontal: 16, paddingBottom: 32, gap: 8 },
  drawerSection: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginLeft: 6,
    marginTop: 14,
    marginBottom: 4,
  },
  group: {
    borderRadius: 14,
    borderWidth: 1,
    overflow: 'hidden',
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 13,
    gap: 12,
  },
  settingLabel: { flex: 1, fontSize: 15 },
  settingValue: { fontSize: 13 },
  divider: { height: 1, marginLeft: 48 },
  signOutButton: {
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 18,
  },
  signOutLabel: { fontSize: 15, fontWeight: '600' },
})
