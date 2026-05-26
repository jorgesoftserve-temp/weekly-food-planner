'use client'

import { useEffect, useState } from 'react'
import { supabaseClient } from '@/utils/supabase/client'

const PENDING_EMAIL_KEY = 'wfp:pending-verify-email'

type Status =
  | { kind: 'idle' }
  | { kind: 'sending' }
  | { kind: 'sent' }
  | { kind: 'error'; message: string }

export const VerifyEmailPanel = () => {
  const [email, setEmail] = useState<string | null>(null)
  const [status, setStatus] = useState<Status>({ kind: 'idle' })

  useEffect(() => {
    const stored =
      typeof window !== 'undefined'
        ? window.sessionStorage.getItem(PENDING_EMAIL_KEY)
        : null
    setEmail(stored)
  }, [])

  const handleResend = async () => {
    if (!email) return
    setStatus({ kind: 'sending' })
    const supabase = supabaseClient()
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback?next=/verify-success`,
      },
    })
    if (error) {
      setStatus({ kind: 'error', message: error.message })
      return
    }
    setStatus({ kind: 'sent' })
  }

  if (!email) {
    return (
      <p className="text-sm text-muted-foreground">
        Didn&apos;t get the email? Open this page from the device you signed up
        on, or{' '}
        <a
          href="/signup"
          className="font-medium underline-offset-4 hover:underline"
        >
          sign up again
        </a>
        .
      </p>
    )
  }

  return (
    <div className="flex flex-col items-center gap-2 text-sm">
      <p className="text-muted-foreground">
        Sent to <span className="font-medium text-foreground">{email}</span>.
      </p>
      {status.kind === 'sent' ? (
        <p className="text-emerald-600 dark:text-emerald-400">
          Verification email re-sent. Check your inbox.
        </p>
      ) : (
        <button
          type="button"
          onClick={handleResend}
          disabled={status.kind === 'sending'}
          className="inline-flex items-center justify-center rounded-md border border-input bg-background px-3 py-1.5 text-sm font-medium shadow-sm hover:bg-accent hover:text-accent-foreground disabled:opacity-50"
        >
          {status.kind === 'sending' ? 'Sending…' : 'Resend verification email'}
        </button>
      )}
      {status.kind === 'error' ? (
        <p className="text-destructive" role="alert">
          {status.message}
        </p>
      ) : null}
    </div>
  )
}
