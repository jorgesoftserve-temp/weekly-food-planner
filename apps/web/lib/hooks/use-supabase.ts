'use client'

import { useMemo } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { supabaseClient } from '@/utils/supabase/client'

// Stable reference to the cached browser Supabase client so React Query
// query/mutation hooks don't see a new instance on every render.
export const useSupabase = (): SupabaseClient => {
  return useMemo(() => supabaseClient(), [])
}
