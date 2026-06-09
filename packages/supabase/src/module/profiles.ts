import type { SupabaseClient } from '@supabase/supabase-js'
import type { AccentColor } from '../types/db.js'

// Re-export flat so app code can `import { AccentColor } from
// '@weekly-food-planner/supabase'` (the barrel only namespaces types/db as DbTypes).
export type { AccentColor } from '../types/db.js'

export type ProfileRecord = {
  id: string
  accent_color: AccentColor
}

export const profileKeys = {
  detail: (userId: string) => ['profile', 'detail', userId] as const,
}

const PROFILE_SELECT = 'id, accent_color'

// RLS guarantees the caller can only read their own row, so the userId is
// passed for the cache key + an explicit filter rather than as a trust boundary.
export const getProfile = async ({
  supabase,
  userId,
}: {
  supabase: SupabaseClient
  userId: string
}): Promise<ProfileRecord | null> => {
  const { data, error } = await supabase
    .from('profiles')
    .select(PROFILE_SELECT)
    .eq('id', userId)
    .maybeSingle()
  if (error) throw new Error(error.message)
  return (data as ProfileRecord | null) ?? null
}

export const updateAccentColor = async ({
  supabase,
  userId,
  accentColor,
}: {
  supabase: SupabaseClient
  userId: string
  accentColor: AccentColor
}): Promise<void> => {
  const { error } = await supabase
    .from('profiles')
    .update({ accent_color: accentColor })
    .eq('id', userId)
  if (error) throw new Error(error.message)
}
