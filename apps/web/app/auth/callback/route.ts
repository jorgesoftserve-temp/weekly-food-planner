import { type NextRequest, NextResponse } from 'next/server'
import { supabaseServerClient } from '@/utils/supabase/server'

// Email-verification callback. Supabase appends ?code=... to the link in the
// confirmation email; we exchange it for a session and redirect home.

export const GET = async (request: NextRequest) => {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/'

  if (code) {
    const supabase = await supabaseServerClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  return NextResponse.redirect(`${origin}/login?error=verification_failed`)
}
