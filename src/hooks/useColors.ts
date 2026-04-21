import { useColorScheme } from 'react-native'
import { useThemeStore } from '../stores/themeStore'
import { darkColors, lightColors, ColorPalette } from '../lib/colors'

export function useEffectiveTheme(): 'light' | 'dark' {
  const mode = useThemeStore(s => s.mode)
  const system = useColorScheme()
  if (mode === 'system') return system === 'light' ? 'light' : 'dark'
  return mode
}

export function useColors(): ColorPalette {
  const theme = useEffectiveTheme()
  return theme === 'light' ? lightColors : darkColors
}
