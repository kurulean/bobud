import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../stores/authStore'

export function useBlocks() {
  const userId = useAuthStore(s => s.user?.id)
  const [blockedIds, setBlockedIds] = useState<string[]>([])

  const refresh = useCallback(async () => {
    if (!userId) { setBlockedIds([]); return }
    const { data, error } = await supabase
      .from('blocks')
      .select('blocked_id')
      .eq('blocker_id', userId)
    if (error) {
      console.error('[useBlocks] fetch failed:', error.message)
      return
    }
    setBlockedIds((data ?? []).map((r: any) => r.blocked_id))
  }, [userId])

  useEffect(() => { refresh() }, [refresh])

  const block = useCallback(async (targetId: string) => {
    if (!userId || targetId === userId) return { error: 'cannot block self' }
    const { error } = await supabase
      .from('blocks')
      .insert({ blocker_id: userId, blocked_id: targetId })
    if (!error) setBlockedIds(prev => [...prev, targetId])
    return { error: error?.message }
  }, [userId])

  const unblock = useCallback(async (targetId: string) => {
    if (!userId) return { error: 'not signed in' }
    const { error } = await supabase
      .from('blocks')
      .delete()
      .eq('blocker_id', userId)
      .eq('blocked_id', targetId)
    if (!error) setBlockedIds(prev => prev.filter(id => id !== targetId))
    return { error: error?.message }
  }, [userId])

  return { blockedIds, block, unblock, refresh }
}
