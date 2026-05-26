import { type NextRequest, NextResponse } from 'next/server'
import { supabaseServerClient } from '@/utils/supabase/server'

// Auth callback for both signup confirmation and password-recovery links.
// Supabase appends `?code=...` to the link; we exchange it for a session and
// redirect to `next` (default /). `next` is constrained to same-origin paths
// to prevent open-redirect attacks.

const sanitizeNext = (raw: string | null): string => {
  if (!raw) return '/'
  if (!raw.startsWith('/') || raw.startsWith('//')) return '/'
  return raw
}

export const GET = async (request: NextRequest) => {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = sanitizeNext(searchParams.get('next'))

  if (code) {
    const supabase = await supabaseServerClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  return NextResponse.redirect(`${origin}/login?error=verification_failed`)
}
