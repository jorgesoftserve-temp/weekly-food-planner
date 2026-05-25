'use client'

import { createBrowserClient } from '@supabase/ssr'
import type { SupabaseClient } from '@supabase/supabase-js'

let cachedClient: SupabaseClient | null = null

// Cached browser client. Safe to reuse across components on the same page; the
// Supabase SDK manages auth state internally.
export const supabaseClient = (): SupabaseClient => {
  if (cachedClient) return cachedClient
  cachedClient = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )
  return cachedClient
}
