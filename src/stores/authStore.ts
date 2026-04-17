import { create } from 'zustand'
import { Session, User } from '@supabase/supabase-js'

interface AuthState {
  session: Session | null
  user: User | null
  isGuest: boolean
  initialized: boolean
  setSession: (session: Session | null) => void
  continueAsGuest: () => void
  reset: () => void
}

export const useAuthStore = create<AuthState>((set) => ({
  session: null,
  user: null,
  isGuest: false,
  initialized: false,
  setSession: (session) => set({
    session,
    user: session?.user ?? null,
    isGuest: false,
    initialized: true,
  }),
  continueAsGuest: () => set({
    session: null,
    user: null,
    isGuest: true,
    initialized: true,
  }),
  reset: () => set({
    session: null,
    user: null,
    isGuest: false,
    initialized: true,
  }),
}))
