import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'
import type { SupabaseClient } from '@supabase/supabase-js'

type CookieToSet = { name: string; value: string; options: CookieOptions }

// Per-request Supabase client for server components, server actions, and route
// handlers. NEVER cache this — each request has its own cookie jar.
export const supabaseServerClient = async (): Promise<SupabaseClient> => {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (cookiesToSet: CookieToSet[]) => {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options)
            }
          } catch {
            // setAll throws inside server components — middleware handles the
            // session refresh path, so this is safe to ignore.
          }
        },
      },
    },
  )
}
