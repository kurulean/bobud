import { useState, useRef, useMemo, useEffect } from 'react'
import {
  View, Text, StyleSheet, TouchableOpacity, Image,
  Alert, ActivityIndicator, TextInput, ScrollView, FlatList,
  KeyboardAvoidingView, Platform, Modal,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { CameraView, CameraType, useCameraPermissions } from 'expo-camera'
import * as Location from 'expo-location'
import * as Haptics from 'expo-haptics'
import * as FileSystem from 'expo-file-system/legacy'
import { decode as decodeBase64 } from 'base64-arraybuffer'
import { Ionicons } from '@expo/vector-icons'
import { supabase } from '../../src/lib/supabase'
import { useMapStore } from '../../src/stores/mapStore'
import { useAuthStore } from '../../src/stores/authStore'
import { haversineDistance } from '../../src/lib/geo'
import { Shop, DrinkTag } from '../../src/types'

const DRINK_TYPES: DrinkTag[] = ['Milk Tea', 'Fruit Tea', 'Matcha', 'Slush', 'Classic']
import { useColors } from '../../src/hooks/useColors'
import { assertClean } from '../../src/lib/profanity'
import { compressImage } from '../../src/lib/image'

// Two-stage flow: 'capture' shows the live camera + shutter,
// 'rate' shows the preview + rating form. No separate routes — just a state machine.

const AUTO_DETECT_RADIUS_MILES = 0.1 // ~500 feet — tight enough that we only auto-fill when the user is physically at the shop

type Stage = 'capture' | 'rate'

export default function CameraScreen() {
  const [permission, requestPermission] = useCameraPermissions()
  const cameraRef = useRef<CameraView>(null)
  const [stage, setStage] = useState<Stage>('capture')
  const [photoUri, setPhotoUri] = useState<string | null>(null)
  const [rating, setRating] = useState(0)
  const [selectedShop, setSelectedShop] = useState<Shop | null>(null)
  const [drinkName, setDrinkName] = useState('')
  const [drinkType, setDrinkType] = useState<DrinkTag | null>(null)
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [shopPickerOpen, setShopPickerOpen] = useState(false)
  const [shopSearch, setShopSearch] = useState('')
  const [autoDetected, setAutoDetected] = useState(false)
  const [facing, setFacing] = useState<CameraType>('back')
  const [shopMenu, setShopMenu] = useState<string[]>([])

  const shops = useMapStore(s => s.shops)
  const user = useAuthStore(s => s.user)
  const isGuest = useAuthStore(s => s.isGuest)
  const c = useColors()

  const filteredShops = useMemo(() => {
    if (!shopSearch.trim()) return shops
    const q = shopSearch.toLowerCase()
    return shops.filter(s => s.name.toLowerCase().includes(q))
  }, [shops, shopSearch])

  // Load the selected shop's menu so we can autocomplete the drink name field.
  // `cancelled` guards against setting state after the shop has changed mid-fetch.
  useEffect(() => {
    if (!selectedShop?.id) { setShopMenu([]); return }
    let cancelled = false
    ;(async () => {
      const { data } = await supabase
        .from('menu_items')
        .select('name')
        .eq('shop_id', selectedShop.id)
      if (!cancelled) setShopMenu((data ?? []).map((d: any) => d.name))
    })()
    return () => { cancelled = true }
  }, [selectedShop?.id])

  // Suggestions: top 5 menu items whose name contains the typed substring.
  // Hide the dropdown once the user's input exactly matches a menu item — no point suggesting the thing they already typed.
  const drinkSuggestions = useMemo(() => {
    const q = drinkName.trim().toLowerCase()
    if (!q || shopMenu.length === 0) return []
    if (shopMenu.some(n => n.toLowerCase() === q)) return []
    return shopMenu.filter(n => n.toLowerCase().includes(q)).slice(0, 5)
  }, [drinkName, shopMenu])

  // Returns the closest shop within AUTO_DETECT_RADIUS_MILES, or null.
  // Silently returns null on any error (permission denied, no GPS fix, etc.) —
  // this is a convenience feature, not a required step.
  async function detectNearestShop() {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync()
      if (status !== 'granted') return null

      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced })
      const here = { latitude: loc.coords.latitude, longitude: loc.coords.longitude }

      const withDistance = shops
        .map(s => ({ shop: s, distance: haversineDistance(here.latitude, here.longitude, s.lat, s.lng) }))
        .sort((a, b) => a.distance - b.distance)

      const closest = withDistance[0]
      if (closest && closest.distance <= AUTO_DETECT_RADIUS_MILES) {
        return closest.shop
      }
      return null
    } catch {
      return null
    }
  }

  // Shutter press: heavy haptic → capture → move to rate stage.
  // We only auto-detect the shop if the user hasn't already picked one — we don't want to overwrite an explicit choice.
  async function takePicture() {
    if (!cameraRef.current) return
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy)
    const photo = await cameraRef.current.takePictureAsync({ quality: 0.7 })
    if (photo?.uri) {
      setPhotoUri(photo.uri)
      setStage('rate')

      if (!selectedShop) {
        const nearest = await detectNearestShop()
        if (nearest) {
          setSelectedShop(nearest)
          setAutoDetected(true)
        }
      }
    }
  }

  function reset() {
    setStage('capture')
    setPhotoUri(null)
    setRating(0)
    setSelectedShop(null)
    setDrinkName('')
    setDrinkType(null)
    setNotes('')
    setAutoDetected(false)
  }

  // Uploads the local image URI to Supabase Storage and returns its public URL.
  // Path is scoped by user id so RLS policies can enforce ownership.
  async function uploadPhoto(uri: string): Promise<string | null> {
    try {
      const compressedUri = await compressImage(uri, 1080, 0.7)
      uri = compressedUri
      const ext = 'jpg'
      const path = `${user?.id ?? 'guest'}/${Date.now()}.${ext}`

      // Base64 → ArrayBuffer path. We can't use `fetch(uri).then(r => r.blob())`
      // on React Native iOS — it yields an empty blob and the bucket ends up with 0-byte files.
      const base64 = await FileSystem.readAsStringAsync(uri, {
        encoding: FileSystem.EncodingType.Base64,
      })
      const arrayBuffer = decodeBase64(base64)

      const { error: uploadError } = await supabase.storage
        .from('drink-photos')
        .upload(path, arrayBuffer, {
          contentType: `image/${ext === 'jpg' ? 'jpeg' : ext}`,
          upsert: false,
        })

      if (uploadError) {
        console.error('[Camera] upload error:', uploadError.message)
        Alert.alert('Upload failed', uploadError.message)
        return null
      }

      const { data } = supabase.storage.from('drink-photos').getPublicUrl(path)
      console.log('[Camera] photo uploaded:', data.publicUrl)
      return data.publicUrl
    } catch (e: any) {
      console.error('[Camera] upload threw:', e?.message)
      Alert.alert('Upload failed', e?.message ?? 'Unknown error')
      return null
    }
  }

  // Validate → upload photo (if any) → insert the review row.
  // Reviews go in with the DB default status ('pending'); silent moderation approves them server-side,
  // so we don't tell the user their review is held for review.
  async function handleSubmit() {
    if (isGuest) {
      Alert.alert('Sign up required', 'You must create an account to post reviews.')
      return
    }
    if (!selectedShop) { Alert.alert('Missing info', 'Please select a shop.'); return }
    if (rating === 0) { Alert.alert('Missing info', 'Please give a rating.'); return }
    if (!user) return
    const bad = assertClean(drinkName, 'drink name') ?? assertClean(notes, 'review')
    if (bad) { Alert.alert('Language not allowed', bad); return }

    try {
      setSubmitting(true)
      let photo_url: string | null = null
      if (photoUri) photo_url = await uploadPhoto(photoUri)

      const { error } = await supabase.from('reviews').insert({
        user_id: user.id,
        shop_id: selectedShop.id,
        rating,
        text: notes || null,
        drink_name: drinkName || null,
        drink_type: drinkType,
        photo_url,
      })
      if (error) throw error

      Alert.alert('Posted!', 'Your review has been shared.')
      reset()
    } catch (e: any) {
      Alert.alert('Error', e.message)
    } finally {
      setSubmitting(false)
    }
  }

  // ---- RENDER ----
  // Three possible views: permission gate, capture stage, rate stage.
  // The first render before permissions resolve shows a plain black view to avoid a flash.

  if (!permission) return <View style={[styles.black, { backgroundColor: c.background }]} />
  if (!permission.granted) {
    return (
      <SafeAreaView style={[{ flex: 1, backgroundColor: c.background, justifyContent: 'center', alignItems: 'center', padding: 32 }]}>
        <Ionicons name="camera-outline" size={48} color={c.placeholder} />
        <Text style={[styles.permissionText, { color: c.secondaryText }]}>Camera access needed to log drinks</Text>
        <TouchableOpacity style={[styles.primaryButton, { backgroundColor: c.accent }]} onPress={requestPermission}>
          <Text style={[styles.primaryLabel, { color: c.accentText }]}>Grant access</Text>
        </TouchableOpacity>
      </SafeAreaView>
    )
  }

  // Capture stage: full-bleed camera preview, shutter button centered, flip button in the bottom-right.
  if (stage === 'capture') {
    return (
      <View style={styles.black}>
        <CameraView ref={cameraRef} style={StyleSheet.absoluteFillObject} facing={facing} />
        <SafeAreaView style={styles.cameraOverlay}>
          <View style={styles.cameraTop}>
            <Text style={styles.cameraHint}>Snap your drink</Text>
          </View>
          <View style={styles.cameraBottom}>
            <TouchableOpacity style={styles.shutter} onPress={takePicture} activeOpacity={0.7}>
              <View style={styles.shutterInner} />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.flipButton}
              onPress={() => {
                Haptics.selectionAsync()
                setFacing(f => (f === 'back' ? 'front' : 'back'))
              }}
              activeOpacity={0.7}
              hitSlop={8}
            >
              <Ionicons name="sync-outline" size={26} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </View>
    )
  }

  // Rate stage: preview + star rating + shop/drink/type card + notes + submit.
  // Index 0 is unused so we can do `ratingLabels[rating]` directly without offsetting.
  const ratingLabels = ['', 'Nope', 'Meh', 'Okay', 'Great', 'Amazing']

  return (
    <SafeAreaView style={[styles.rateContainer, { backgroundColor: c.background }]}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.rateHeader}>
          <TouchableOpacity onPress={reset} style={[styles.headerBtn, { backgroundColor: c.surface }]} activeOpacity={0.6}>
            <Ionicons name="close" size={24} color={c.primaryText} />
          </TouchableOpacity>
        </View>

        <ScrollView
          contentContainerStyle={styles.rateContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {photoUri && (
            <View style={styles.photoWrap}>
              <Image source={{ uri: photoUri }} style={[styles.preview, { backgroundColor: c.surface }]} />
            </View>
          )}

          <View style={styles.ratingBlock}>
            <Text style={[styles.prompt, { color: c.primaryText }]}>How was it?</Text>
            <View style={styles.starsRow}>
              {[1, 2, 3, 4, 5].map(n => (
                <TouchableOpacity
                  key={n}
                  onPress={() => {
                    setRating(n)
                    Haptics.selectionAsync()
                  }}
                  activeOpacity={0.6}
                  hitSlop={8}
                >
                  <Ionicons
                    name={n <= rating ? 'star' : 'star-outline'}
                    size={38}
                    color={n <= rating ? c.star : c.border}
                  />
                </TouchableOpacity>
              ))}
            </View>
            <Text style={[styles.ratingLabel, { color: c.secondaryText }]}>
              {rating > 0 ? ratingLabels[rating] : 'Tap to rate'}
            </Text>
          </View>

          <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]}>
            <TouchableOpacity
              style={styles.cardRow}
              onPress={() => {
                setShopPickerOpen(true)
                setAutoDetected(false)
              }}
              activeOpacity={0.6}
            >
              <Text style={[styles.cardLabel, { color: c.secondaryText }]}>Shop</Text>
              <View style={styles.cardValueWrap}>
                <Text
                  style={[styles.cardValue, { color: c.primaryText }, !selectedShop && { color: c.placeholder }]}
                  numberOfLines={1}
                >
                  {selectedShop?.name ?? 'Select a shop'}
                </Text>
                {autoDetected && selectedShop && (
                  <View style={[styles.autoBadge, { backgroundColor: c.accent }]}>
                    <Ionicons name="location" size={10} color={c.accentText} />
                    <Text style={[styles.autoBadgeText, { color: c.accentText }]}>Auto</Text>
                  </View>
                )}
                <Ionicons name="chevron-forward" size={16} color={c.placeholder} />
              </View>
            </TouchableOpacity>

            <View style={[styles.cardDivider, { backgroundColor: c.border }]} />

            <View style={styles.cardRow}>
              <Text style={[styles.cardLabel, { color: c.secondaryText }]}>Drink</Text>
              <TextInput
                style={[styles.cardInput, { color: c.primaryText }]}
                placeholder={shopMenu.length > 0 ? 'Search the menu...' : 'e.g. Taro Milk Tea'}
                placeholderTextColor={c.placeholder}
                value={drinkName}
                onChangeText={setDrinkName}
              />
            </View>

            {drinkSuggestions.length > 0 && (
              <View style={[styles.suggestionsWrap, { borderTopColor: c.border }]}>
                {drinkSuggestions.map(name => (
                  <TouchableOpacity
                    key={name}
                    style={styles.suggestionRow}
                    onPress={() => setDrinkName(name)}
                    activeOpacity={0.6}
                  >
                    <Ionicons name="search-outline" size={14} color={c.placeholder} />
                    <Text style={[styles.suggestionLabel, { color: c.primaryText }]} numberOfLines={1}>
                      {name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            <View style={[styles.cardDivider, { backgroundColor: c.border }]} />

            <View style={[styles.cardRow, { flexDirection: 'column', alignItems: 'stretch', gap: 10 }]}>
              <Text style={[styles.cardLabel, { color: c.secondaryText, width: undefined }]}>Type</Text>
              <View style={styles.typeRow}>
                {DRINK_TYPES.map(t => {
                  const active = drinkType === t
                  return (
                    <TouchableOpacity
                      key={t}
                      onPress={() => setDrinkType(active ? null : t)}
                      activeOpacity={0.75}
                      style={[
                        styles.typePill,
                        {
                          backgroundColor: active ? c.accent : 'transparent',
                          borderColor: active ? c.accent : c.border,
                        },
                      ]}
                    >
                      <Text style={[
                        styles.typePillLabel,
                        { color: active ? c.accentText : c.secondaryText },
                      ]}>
                        {t}
                      </Text>
                    </TouchableOpacity>
                  )
                })}
              </View>
            </View>
          </View>

          <TextInput
            style={[styles.notesInput, { backgroundColor: c.surface, borderColor: c.border, color: c.primaryText }]}
            placeholder="Add a note about this drink..."
            placeholderTextColor={c.placeholder}
            value={notes}
            onChangeText={setNotes}
            multiline
          />
        </ScrollView>

        <View style={[styles.footer, { backgroundColor: c.background, borderTopColor: c.borderSubtle }]}>
          <TouchableOpacity
            style={[
              styles.primaryButton,
              { backgroundColor: c.accent },
              (submitting || rating === 0 || !selectedShop) && styles.primaryButtonDisabled,
            ]}
            onPress={handleSubmit}
            disabled={submitting || rating === 0 || !selectedShop}
            activeOpacity={0.85}
          >
            {submitting
              ? <ActivityIndicator color={c.accentText} />
              : <Text style={[styles.primaryLabel, { color: c.accentText }]}>Post review</Text>
            }
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

      <Modal visible={shopPickerOpen} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={[styles.modalContainer, { backgroundColor: c.background }]}>
          <View style={[styles.modalHeader, { borderBottomColor: c.borderSubtle }]}>
            <Text style={[styles.modalTitle, { color: c.primaryText }]}>Select a shop</Text>
            <TouchableOpacity onPress={() => setShopPickerOpen(false)}>
              <Ionicons name="close" size={24} color={c.primaryText} />
            </TouchableOpacity>
          </View>
          <TextInput
            style={[styles.modalSearch, { backgroundColor: c.surface, borderColor: c.border, color: c.primaryText }]}
            placeholder="Search shops..."
            placeholderTextColor={c.placeholder}
            value={shopSearch}
            onChangeText={setShopSearch}
          />
          <FlatList
            data={filteredShops}
            keyExtractor={item => item.id}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[styles.modalRow, { borderBottomColor: c.surface }]}
                onPress={() => {
                  setSelectedShop(item)
                  setShopPickerOpen(false)
                  setShopSearch('')
                }}
              >
                <View style={{ flex: 1 }}>
                  <Text style={[styles.modalRowName, { color: c.primaryText }]}>{item.name}</Text>
                  <Text style={[styles.modalRowAddress, { color: c.secondaryText }]}>{item.address}</Text>
                </View>
                {selectedShop?.id === item.id && (
                  <Ionicons name="checkmark" size={20} color={c.primaryText} />
                )}
              </TouchableOpacity>
            )}
            ListEmptyComponent={<Text style={[styles.empty, { color: c.placeholder }]}>No shops found</Text>}
          />
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  black: { flex: 1, backgroundColor: '#000000' },
  permissionText: { color: '#888888', fontSize: 15, marginTop: 16, marginBottom: 24, textAlign: 'center' },

  cameraOverlay: {
    flex: 1,
    justifyContent: 'space-between',
  },
  cameraTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 16,
    position: 'relative',
  },
  cameraHint: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '500',
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
  },
  cameraBottom: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 32,
    paddingBottom: 16,
    position: 'relative',
  },
  shutter: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderWidth: 3,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  shutterInner: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#FFFFFF',
  },
  flipButton: {
    position: 'absolute',
    right: 28,
    bottom: 30,
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  rateContainer: { flex: 1, backgroundColor: '#0D0D0D' },
  rateContent: { paddingHorizontal: 20, paddingBottom: 120, gap: 20 },
  rateHeader: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  headerBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#1A1A1A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoWrap: {
    alignItems: 'center',
    marginTop: 4,
  },
  preview: {
    width: 220,
    height: 220,
    borderRadius: 20,
    backgroundColor: '#1A1A1A',
  },
  ratingBlock: {
    alignItems: 'center',
    gap: 10,
    paddingVertical: 4,
  },
  prompt: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: -0.3,
  },
  starsRow: {
    flexDirection: 'row',
    gap: 12,
    marginVertical: 4,
  },
  ratingLabel: {
    fontSize: 13,
    color: '#666666',
    fontWeight: '500',
    minHeight: 18,
  },
  card: {
    backgroundColor: '#1A1A1A',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#2A2A2A',
    overflow: 'hidden',
  },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
  },
  cardDivider: {
    height: 1,
    backgroundColor: '#2A2A2A',
    marginHorizontal: 16,
  },
  cardLabel: {
    fontSize: 13,
    color: '#666666',
    width: 52,
    fontWeight: '500',
  },
  cardValueWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  cardValue: { flex: 1, fontSize: 15, color: '#FFFFFF' },
  cardInput: { flex: 1, fontSize: 15, color: '#FFFFFF', padding: 0 },
  placeholder: { color: '#555555' },
  autoBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
  },
  autoBadgeText: { fontSize: 10, fontWeight: '700', color: '#000000' },
  suggestionsWrap: {
    paddingHorizontal: 16,
    paddingBottom: 8,
    borderTopWidth: 1,
    gap: 2,
    paddingTop: 6,
  },
  suggestionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
  },
  suggestionLabel: { fontSize: 14, flex: 1 },
  typeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  typePill: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
  },
  typePillLabel: { fontSize: 13, fontWeight: '600' },
  notesInput: {
    backgroundColor: '#1A1A1A',
    borderWidth: 1,
    borderColor: '#2A2A2A',
    borderRadius: 16,
    padding: 16,
    fontSize: 15,
    color: '#FFFFFF',
    minHeight: 100,
    textAlignVertical: 'top',
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 24,
    backgroundColor: 'rgba(13,13,13,0.95)',
    borderTopWidth: 1,
    borderTopColor: '#1E1E1E',
  },
  primaryButton: {
    backgroundColor: '#111d4a',
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
  },
  primaryButtonDisabled: {
    opacity: 0.35,
  },
  primaryLabel: { fontSize: 15, fontWeight: '600', color: '#FFFFFF' },

  modalContainer: { flex: 1, backgroundColor: '#0D0D0D' },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#1E1E1E',
  },
  modalTitle: { fontSize: 18, fontWeight: '700', color: '#FFFFFF' },
  modalSearch: {
    margin: 16,
    backgroundColor: '#1A1A1A',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    color: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#2A2A2A',
  },
  modalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#1A1A1A',
  },
  modalRowName: { fontSize: 15, fontWeight: '600', color: '#FFFFFF' },
  modalRowAddress: { fontSize: 12, color: '#666666', marginTop: 2 },
  empty: { textAlign: 'center', color: '#555555', padding: 40 },
})
