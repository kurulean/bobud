import { create } from 'zustand'
import AsyncStorage from '@react-native-async-storage/async-storage'

export type ThemeMode = 'light' | 'dark' | 'system'

interface ThemeState {
  mode: ThemeMode
  initialized: boolean
  setMode: (mode: ThemeMode) => void
  init: () => Promise<void>
}

const STORAGE_KEY = 'bobud:themeMode'

export const useThemeStore = create<ThemeState>((set) => ({
  mode: 'dark',
  initialized: false,
  setMode: (mode) => {
    set({ mode })
    AsyncStorage.setItem(STORAGE_KEY, mode).catch(() => {})
  },
  init: async () => {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEY)
      if (stored === 'light' || stored === 'dark' || stored === 'system') {
        set({ mode: stored })
      }
    } catch {
      /* no-op */
    }
    set({ initialized: true })
  },
}))
