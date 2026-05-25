import { createClient } from '@supabase/supabase-js'
import type { SupabaseClient } from '@supabase/supabase-js'

let cachedAdmin: SupabaseClient | null = null

// Service-role client. Bypasses RLS — only use it on the server for privileged
// operations (workspace bootstrapping, generation persistence, soft-delete
// overrides). Never expose to the browser.
export const supabaseAdminClient = (): SupabaseClient => {
  if (cachedAdmin) return cachedAdmin
  cachedAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  )
  return cachedAdmin
}
