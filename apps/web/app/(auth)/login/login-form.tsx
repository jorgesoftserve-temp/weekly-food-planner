'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useState, type FormEvent } from 'react'
import { supabaseClient } from '@/utils/supabase/client'
import {
  authInputClass,
  authLinkClass,
  authPrimaryButtonClass,
  authSuccessNoteClass,
  authWarningNoteClass,
} from '../_components/auth-ui'

type FormState = {
  email: string
  password: string
}

const initialState: FormState = { email: '', password: '' }

// Only honour same-origin relative paths from `?next=` to avoid open-redirect
// vectors (an attacker linking /login?next=https://evil.example would bounce
// authenticated sessions off-site).
const sanitizeNext = (raw: string | null): string => {
  if (!raw) return '/dashboard'
  if (!raw.startsWith('/') || raw.startsWith('//')) return '/dashboard'
  return raw
}

type ErrorState =
  | { kind: 'generic'; message: string }
  | { kind: 'not_confirmed'; message: string; email: string }
  | null

type ResendState =
  | { kind: 'idle' }
  | { kind: 'sending' }
  | { kind: 'sent' }
  | { kind: 'error'; message: string }

export const LoginForm = () => {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [form, setForm] = useState<FormState>(initialState)
  const [error, setError] = useState<ErrorState>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [resend, setResend] = useState<ResendState>({ kind: 'idle' })

  const justReset = searchParams.get('reset') === '1'

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)
    setResend({ kind: 'idle' })
    setIsSubmitting(true)
    const supabase = supabaseClient()
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: form.email,
      password: form.password,
    })
    setIsSubmitting(false)
    if (signInError) {
      // Supabase exposes the machine code on `.code` for newer SDKs and falls
      // back to a substring match for older ones. Both paths land here.
      const code = (signInError as { code?: string }).code
      const isUnconfirmed =
        code === 'email_not_confirmed' ||
        signInError.message.toLowerCase().includes('not confirmed')
      if (isUnconfirmed) {
        setError({
          kind: 'not_confirmed',
          email: form.email,
          message:
            "You haven't confirmed this email yet. Check your inbox for the verification link.",
        })
        return
      }
      setError({ kind: 'generic', message: signInError.message })
      return
    }
    router.push(sanitizeNext(searchParams.get('next')))
    router.refresh()
  }

  const handleResend = async () => {
    if (error?.kind !== 'not_confirmed') return
    setResend({ kind: 'sending' })
    const supabase = supabaseClient()
    const { error: resendError } = await supabase.auth.resend({
      type: 'signup',
      email: error.email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback?next=/verify-success`,
      },
    })
    if (resendError) {
      setResend({ kind: 'error', message: resendError.message })
      return
    }
    setResend({ kind: 'sent' })
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      {justReset ? (
        <p className={authSuccessNoteClass} role="status">
          Password updated. Sign in with your new password.
        </p>
      ) : null}
      <label className="flex flex-col gap-1.5 text-sm font-medium">
        Email
        <input
          type="email"
          required
          value={form.email}
          onChange={(event) =>
            setForm((prev) => ({ ...prev, email: event.target.value }))
          }
          className={authInputClass}
        />
      </label>
      <label className="flex flex-col gap-1.5 text-sm font-medium">
        <span className="flex items-center justify-between">
          Password
          <a
            href="/forgot-password"
            className="text-xs font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
          >
            Forgot?
          </a>
        </span>
        <input
          type="password"
          required
          value={form.password}
          onChange={(event) =>
            setForm((prev) => ({ ...prev, password: event.target.value }))
          }
          className={authInputClass}
        />
      </label>
      {error?.kind === 'generic' ? (
        <p className="text-sm text-destructive" role="alert">
          {error.message}
        </p>
      ) : null}
      {error?.kind === 'not_confirmed' ? (
        <div className={authWarningNoteClass} role="alert">
          <p>{error.message}</p>
          {resend.kind === 'sent' ? (
            <p>Verification email re-sent — check your inbox.</p>
          ) : (
            <button
              type="button"
              onClick={handleResend}
              disabled={resend.kind === 'sending'}
              className="self-start text-xs font-medium underline underline-offset-4 disabled:opacity-50"
            >
              {resend.kind === 'sending'
                ? 'Resending…'
                : 'Resend verification email'}
            </button>
          )}
          {resend.kind === 'error' ? <p>{resend.message}</p> : null}
        </div>
      ) : null}
      <button type="submit" disabled={isSubmitting} className={authPrimaryButtonClass}>
        {isSubmitting ? 'Signing in…' : 'Sign in'}
      </button>
      <p className="text-center text-sm text-muted-foreground">
        {"Don't have an account? "}
        <a href="/signup" className={authLinkClass}>
          Sign up
        </a>
      </p>
    </form>
  )
}
