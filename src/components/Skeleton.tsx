import { useEffect, useRef } from 'react'
import { Animated, StyleSheet, ViewStyle } from 'react-native'
import { useColors } from '../hooks/useColors'

export function Skeleton({ style }: { style?: ViewStyle | ViewStyle[] }) {
  const c = useColors()
  const opacity = useRef(new Animated.Value(0.4)).current

  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.9, duration: 700, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.4, duration: 700, useNativeDriver: true }),
      ]),
    )
    anim.start()
    return () => anim.stop()
  }, [])

  return <Animated.View style={[styles.base, { backgroundColor: c.border, opacity }, style]} />
}

export function FeedCardSkeleton() {
  const c = useColors()
  return (
    <Animated.View style={[cardStyles.card, { backgroundColor: c.surface }]}>
      <Animated.View style={cardStyles.header}>
        <Skeleton style={cardStyles.avatar} />
        <Animated.View style={{ flex: 1, gap: 6 }}>
          <Skeleton style={{ height: 12, width: '40%', borderRadius: 4 }} />
          <Skeleton style={{ height: 10, width: '60%', borderRadius: 4 }} />
        </Animated.View>
      </Animated.View>
      <Skeleton style={cardStyles.photo} />
      <Animated.View style={{ padding: 14, gap: 8 }}>
        <Skeleton style={{ height: 12, width: '30%', borderRadius: 4 }} />
        <Skeleton style={{ height: 12, width: '85%', borderRadius: 4 }} />
      </Animated.View>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  base: {
    borderRadius: 6,
    overflow: 'hidden',
  },
})

const cardStyles = StyleSheet.create({
  card: { overflow: 'hidden' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 10,
  },
  avatar: { width: 36, height: 36, borderRadius: 18 },
  photo: { width: '100%', aspectRatio: 4 / 5, borderRadius: 0 },
})
