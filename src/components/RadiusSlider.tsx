import { useRef, useEffect } from 'react'
import { View, StyleSheet, PanResponder } from 'react-native'

interface Props {
  value: number
  min: number
  max: number
  step: number
  onChange: (value: number) => void
}

export default function RadiusSlider({ value, min, max, step, onChange }: Props) {
  const trackWidth = useRef(0)
  const startX = useRef(0)
  const startValue = useRef(value)
  const valueRef = useRef(value)
  const onChangeRef = useRef(onChange)

  useEffect(() => { valueRef.current = value }, [value])
  useEffect(() => { onChangeRef.current = onChange }, [onChange])

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (e) => {
        startX.current = e.nativeEvent.pageX
        startValue.current = valueRef.current
      },
      onPanResponderMove: (e) => {
        if (trackWidth.current === 0) return
        const dx = e.nativeEvent.pageX - startX.current
        const delta = (dx / trackWidth.current) * (max - min)
        const raw = startValue.current + delta
        const stepped = Math.round(raw / step) * step
        onChangeRef.current(Math.max(min, Math.min(max, stepped)))
      },
    })
  ).current

  const percent = (value - min) / (max - min)

  return (
    <View
      style={styles.track}
      onLayout={(e) => { trackWidth.current = e.nativeEvent.layout.width }}
      {...panResponder.panHandlers}
    >
      <View style={[styles.fill, { width: `${percent * 100}%` }]} />
      <View style={[styles.thumb, { left: `${percent * 100}%` }]} />
    </View>
  )
}

const styles = StyleSheet.create({
  track: {
    height: 4,
    backgroundColor: '#2A2A2A',
    borderRadius: 2,
    justifyContent: 'center',
  },
  fill: {
    height: 4,
    backgroundColor: '#FFFFFF',
    borderRadius: 2,
  },
  thumb: {
    position: 'absolute',
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    marginLeft: -10,
    top: -8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 4,
  },
})
