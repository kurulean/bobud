import { useState, useEffect, useRef, useMemo } from 'react'
import { View, Text, StyleSheet, TextInput, ActivityIndicator } from 'react-native'
import MapView, { Marker } from 'react-native-maps'
import * as Location from 'expo-location'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { useMapStore } from '../../src/stores/mapStore'
import { haversineDistance } from '../../src/lib/geo'
import RadiusSlider from '../../src/components/RadiusSlider'
import ShopDetailSheet from '../../src/components/ShopDetailSheet'
import { useColors } from '../../src/hooks/useColors'

const DEFAULT_LOCATION = { latitude: 33.6846, longitude: -117.8265 }

export default function MapScreen() {
  const insets = useSafeAreaInsets()
  const {
    radius, setRadius,
    userLocation, setUserLocation,
    selectedShop, setSelectedShop,
    shops, loading, error, fetchShops,
  } = useMapStore()
  const [search, setSearch] = useState('')
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const c = useColors()

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

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
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
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      fetchShops()
    }, 400)
  }

  return (
    <View style={[styles.container, { backgroundColor: c.background }]}>
      <MapView
        style={StyleSheet.absoluteFillObject}
        initialRegion={{ ...loc, latitudeDelta: 0.15, longitudeDelta: 0.15 }}
        showsUserLocation
        showsMyLocationButton={false}
      >
        {nearbyShops.map(shop => {
          const isSelected = selectedShop?.id === shop.id
          return (
            <Marker
              key={shop.id}
              coordinate={{ latitude: shop.lat, longitude: shop.lng }}
              onPress={() => setSelectedShop(shop)}
              anchor={{ x: 0.5, y: 1 }}
              tracksViewChanges={false}
            >
              <View style={styles.markerWrap}>
                <Ionicons
                  name="location"
                  size={32}
                  color={isSelected ? c.accent : '#FF3B30'}
                  style={styles.markerShadow}
                />
              </View>
            </Marker>
          )
        })}
      </MapView>

      <View style={[styles.overlay, { paddingTop: insets.top + 12, backgroundColor: c.overlay }]}>
        <TextInput
          style={[styles.searchInput, { backgroundColor: c.surface, borderColor: c.border, color: c.primaryText }]}
          placeholder="Search boba shops..."
          placeholderTextColor={c.placeholder}
          value={search}
          onChangeText={setSearch}
        />

        <View style={styles.radiusRow}>
          <View style={[styles.radiusPill, { backgroundColor: c.accent }]}>
            <Text style={[styles.radiusText, { color: c.accentText }]}>{radius} mi</Text>
          </View>
          {loading
            ? <ActivityIndicator size="small" color={c.secondaryText} />
            : error
              ? <Text style={[styles.shopCount, { color: c.error }]} numberOfLines={1}>Couldn't load shops</Text>
              : <Text style={[styles.shopCount, { color: c.secondaryText }]}>{nearbyShops.length} shops found</Text>
          }
        </View>

        <View style={styles.sliderWrap}>
          <RadiusSlider value={radius} min={1} max={50} step={1} onChange={handleRadiusChange} />
        </View>
      </View>

      {selectedShop && (
        <ShopDetailSheet
          shop={selectedShop}
          bottomInset={insets.bottom}
          onClose={() => setSelectedShop(null)}
        />
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
    backgroundColor: '#111d4a',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 20,
  },
  radiusText: { fontSize: 13, fontWeight: '700', color: '#FFFFFF' },
  shopCount: { fontSize: 13, color: '#666666' },
  sliderWrap: {
    alignSelf: 'center',
    width: '80%',
    paddingVertical: 4,
  },
  markerWrap: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  markerShadow: {
    textShadowColor: 'rgba(0,0,0,0.4)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
})
