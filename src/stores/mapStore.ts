import { create } from 'zustand'
import { Shop } from '../types'
import { supabase } from '../lib/supabase'

export interface ShopWithDistance extends Shop {
  distance: number
}

interface MapState {
  radius: number
  setRadius: (radius: number) => void
  userLocation: { latitude: number; longitude: number } | null
  setUserLocation: (loc: { latitude: number; longitude: number }) => void
  selectedShop: ShopWithDistance | null
  setSelectedShop: (shop: ShopWithDistance | null) => void
  shops: Shop[]
  loading: boolean
  error: string | null
  fetchShops: () => Promise<void>
}

export const useMapStore = create<MapState>((set) => ({
  radius: 10,
  setRadius: (radius) => set({ radius }),
  userLocation: null,
  setUserLocation: (userLocation) => set({ userLocation }),
  selectedShop: null,
  setSelectedShop: (selectedShop) => set({ selectedShop }),
  shops: [],
  loading: false,
  error: null,
  fetchShops: async () => {
    set({ loading: true, error: null })
    try {
      const { data, error } = await supabase.from('shops').select('*')
      if (error) throw error
      set({ shops: (data ?? []) as Shop[], loading: false })
    } catch (e: any) {
      console.error('[mapStore] fetchShops failed:', e.message)
      set({ error: e.message ?? 'Failed to fetch shops', loading: false })
    }
  },
}))
