import { create } from 'zustand'
import { Session, User } from '@supabase/supabase-js'

export interface Profile {
  id: string
  username: string | null
  avatar_url: string | null
  created_at: string
}

interface AuthState {
  session: Session | null
  user: User | null
  profile: Profile | null
  isGuest: boolean
  initialized: boolean
  setSession: (session: Session | null) => void
  setProfile: (profile: Profile | null) => void
  continueAsGuest: () => void
  reset: () => void
}

export const useAuthStore = create<AuthState>((set) => ({
  session: null,
  user: null,
  profile: null,
  isGuest: false,
  initialized: false,
  setSession: (session) => set({
    session,
    user: session?.user ?? null,
    isGuest: false,
    initialized: true,
  }),
  setProfile: (profile) => set({ profile }),
  continueAsGuest: () => set({
    session: null,
    user: null,
    profile: null,
    isGuest: true,
    initialized: true,
  }),
  reset: () => set({
    session: null,
    user: null,
    profile: null,
    isGuest: false,
    initialized: true,
  }),
}))
