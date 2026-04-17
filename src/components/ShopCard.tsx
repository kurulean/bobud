import { StyleSheet, Text, View, TouchableOpacity } from 'react-native'
import { Shop } from '../types'

interface Props {
  shop: Shop
  distance?: number
  onPress?: () => void
}

export default function ShopCard({ shop, distance, onPress }: Props) {
  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.75}>
      <View style={styles.imagePlaceholder}>
        <Text style={styles.imagePlaceholderIcon}>🧋</Text>
      </View>

      <View style={styles.info}>
        <Text style={styles.name} numberOfLines={1}>{shop.name}</Text>
        <Text style={styles.address} numberOfLines={1}>{shop.address}</Text>

        <View style={styles.meta}>
          <View style={styles.ratingPill}>
            <Text style={styles.ratingText}>⭐ {shop.rating.toFixed(1)}</Text>
          </View>
          <Text style={styles.reviewCount}>{shop.review_count} reviews</Text>
          {distance !== undefined && (
            <Text style={styles.distance}>{distance.toFixed(1)} mi</Text>
          )}
        </View>
      </View>
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    backgroundColor: '#1A1A1A',
    borderRadius: 16,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#2A2A2A',
  },
  imagePlaceholder: {
    width: 72,
    height: 72,
    borderRadius: 12,
    backgroundColor: '#242424',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  imagePlaceholderIcon: {
    fontSize: 32,
  },
  info: {
    flex: 1,
    justifyContent: 'space-between',
  },
  name: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 2,
  },
  address: {
    fontSize: 13,
    color: '#666666',
    marginBottom: 8,
  },
  meta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  ratingPill: {
    backgroundColor: '#242424',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 20,
  },
  ratingText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  reviewCount: {
    fontSize: 12,
    color: '#555555',
  },
  distance: {
    fontSize: 12,
    color: '#555555',
    marginLeft: 'auto',
  },
})
