import { create } from 'zustand'
import { Session, User } from '@supabase/supabase-js'

interface AuthState {
  session: Session | null
  user: User | null
  isGuest: boolean
  initialized: boolean
  setSession: (session: Session | null) => void
  setGuest: () => void
  signOut: () => void
}

export const useAuthStore = create<AuthState>((set) => ({
  session: null,
  user: null,
  isGuest: false,
  initialized: false,
  setSession: (session) =>
    set({ session, user: session?.user ?? null, isGuest: false, initialized: true }),
  setGuest: () =>
    set({ session: null, user: null, isGuest: true, initialized: true }),
  signOut: () =>
    set({ session: null, user: null, isGuest: false, initialized: true }),
}))
