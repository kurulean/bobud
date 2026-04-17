import { useState, useEffect, useRef, useMemo } from 'react'
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ActivityIndicator } from 'react-native'
import MapView, { Marker } from 'react-native-maps'
import * as Location from 'expo-location'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { useMapStore } from '../../src/stores/mapStore'
import { haversineDistance } from '../../src/lib/geo'
import RadiusSlider from '../../src/components/RadiusSlider'

const DEFAULT_LOCATION = { latitude: 33.6846, longitude: -117.8265 }

export default function MapScreen() {
  const insets = useSafeAreaInsets()
  const {
    radius, setRadius,
    userLocation, setUserLocation,
    selectedShop, setSelectedShop,
    shops, loading, fetchShops,
  } = useMapStore()
  const [search, setSearch] = useState('')
  const debounceRef = useRef<ReturnType<typeof setTimeout>>()

  useEffect(() => {
    fetchShops()
    ;(async () => {
      const { status } = await Location.requestForegroundPermissionsAsync()
      if (status === 'granted') {
        const loc = await Location.getCurrentPositionAsync({})
        setUserLocation({ latitude: loc.coords.latitude, longitude: loc.coords.longitude })
      } else {
        setUserLocation(DEFAULT_LOCATION)
      }
    })()
  }, [])

  const loc = userLocation ?? DEFAULT_LOCATION

  const nearbyShops = useMemo(() => {
    return shops
      .map(shop => ({
        ...shop,
        distance: haversineDistance(loc.latitude, loc.longitude, shop.lat, shop.lng),
      }))
      .filter(shop => shop.distance <= radius)
      .filter(shop =>
        !search.trim() || shop.name.toLowerCase().includes(search.toLowerCase())
      )
  }, [shops, loc, radius, search])

  function handleRadiusChange(value: number) {
    setRadius(value)
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      fetchShops()
    }, 400)
  }

  return (
    <View style={styles.container}>
      <MapView
        style={StyleSheet.absoluteFillObject}
        initialRegion={{ ...loc, latitudeDelta: 0.15, longitudeDelta: 0.15 }}
        showsUserLocation
        showsMyLocationButton={false}
      >
        {nearbyShops.map(shop => (
          <Marker
            key={shop.id}
            coordinate={{ latitude: shop.lat, longitude: shop.lng }}
            onPress={() => setSelectedShop(shop)}
          >
            <View style={[styles.marker, selectedShop?.id === shop.id && styles.markerSelected]}>
              <Text style={styles.markerText}>🧋</Text>
            </View>
          </Marker>
        ))}
      </MapView>

      <View style={[styles.overlay, { paddingTop: insets.top + 12 }]}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search boba shops..."
          placeholderTextColor="#555555"
          value={search}
          onChangeText={setSearch}
        />

        <View style={styles.radiusRow}>
          <View style={styles.radiusPill}>
            <Text style={styles.radiusText}>{radius} mi</Text>
          </View>
          {loading
            ? <ActivityIndicator size="small" color="#666666" />
            : <Text style={styles.shopCount}>{nearbyShops.length} shops found</Text>
          }
        </View>

        <RadiusSlider value={radius} min={5} max={100} step={5} onChange={handleRadiusChange} />
      </View>

      {selectedShop && (
        <View style={[styles.bottomCard, { paddingBottom: insets.bottom + 12 }]}>
          <TouchableOpacity style={styles.dismissHint} onPress={() => setSelectedShop(null)}>
            <View style={styles.handle} />
          </TouchableOpacity>

          <View style={styles.cardContent}>
            <View style={styles.cardInfo}>
              <Text style={styles.cardName}>{selectedShop.name}</Text>
              <Text style={styles.cardAddress}>{selectedShop.address}</Text>
              <View style={styles.cardMeta}>
                <Text style={styles.cardRating}>⭐ {selectedShop.rating.toFixed(1)}</Text>
                <Text style={styles.cardDot}>·</Text>
                <Text style={styles.cardDistance}>{selectedShop.distance.toFixed(1)} mi</Text>
                <Text style={styles.cardDot}>·</Text>
                <Text style={styles.cardReviews}>{selectedShop.review_count} reviews</Text>
              </View>
            </View>

            <TouchableOpacity
              style={styles.detailButton}
              onPress={() => router.push({ pathname: '/shop/[id]', params: { id: selectedShop.id } })}
              activeOpacity={0.85}
            >
              <Text style={styles.detailButtonText}>View</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0D0D0D' },
  overlay: {
    position: 'absolute',
    top: 0, left: 0, right: 0,
    paddingHorizontal: 16,
    paddingBottom: 16,
    gap: 10,
    backgroundColor: 'rgba(13,13,13,0.85)',
  },
  searchInput: {
    backgroundColor: '#1A1A1A',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontSize: 14,
    color: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#2A2A2A',
  },
  radiusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  radiusPill: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 20,
  },
  radiusText: { fontSize: 13, fontWeight: '700', color: '#000000' },
  shopCount: { fontSize: 13, color: '#666666' },
  marker: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: '#1A1A1A',
    borderWidth: 2, borderColor: '#2A2A2A',
    alignItems: 'center', justifyContent: 'center',
  },
  markerSelected: { borderColor: '#FFFFFF', backgroundColor: '#2A2A2A' },
  markerText: { fontSize: 18 },
  bottomCard: {
    position: 'absolute',
    bottom: 0, left: 0, right: 0,
    backgroundColor: '#1A1A1A',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderWidth: 1,
    borderColor: '#2A2A2A',
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  dismissHint: { alignItems: 'center', paddingVertical: 6 },
  handle: { width: 36, height: 4, borderRadius: 2, backgroundColor: '#3A3A3A' },
  cardContent: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8 },
  cardInfo: { flex: 1, gap: 3 },
  cardName: { fontSize: 16, fontWeight: '600', color: '#FFFFFF' },
  cardAddress: { fontSize: 13, color: '#666666' },
  cardMeta: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  cardRating: { fontSize: 13, color: '#AAAAAA' },
  cardDot: { fontSize: 13, color: '#444444' },
  cardDistance: { fontSize: 13, color: '#AAAAAA' },
  cardReviews: { fontSize: 13, color: '#AAAAAA' },
  detailButton: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 18, paddingVertical: 10,
    borderRadius: 12,
  },
  detailButtonText: { fontSize: 14, fontWeight: '600', color: '#000000' },
})
