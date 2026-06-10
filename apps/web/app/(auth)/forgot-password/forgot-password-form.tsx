'use client'

import { useState, type FormEvent } from 'react'
import { supabaseClient } from '@/utils/supabase/client'
import {
  authInputClass,
  authLinkClass,
  authPrimaryButtonClass,
} from '../_components/auth-ui'

type FormState = {
  email: string
}

const initialState: FormState = { email: '' }

export const ForgotPasswordForm = () => {
  const [form, setForm] = useState<FormState>(initialState)
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [sent, setSent] = useState(false)

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)
    setIsSubmitting(true)
    const supabase = supabaseClient()
    const redirectTo = `${window.location.origin}/auth/callback?next=/reset-password`
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(
      form.email,
      { redirectTo },
    )
    setIsSubmitting(false)
    if (resetError) {
      setError(resetError.message)
      return
    }
    setSent(true)
  }

  if (sent) {
    return (
      <div className="flex flex-col gap-3">
        <p className="text-sm text-foreground">
          If an account exists for{' '}
          <span className="font-medium">{form.email}</span>, we&apos;ve sent it
          a password reset link. Check your inbox.
        </p>
        <p className="text-sm text-muted-foreground">
          Didn&apos;t arrive?{' '}
          <button
            type="button"
            onClick={() => setSent(false)}
            className="font-medium underline underline-offset-4 hover:text-foreground"
          >
            Try again
          </button>
        </p>
        <p className="text-center text-sm text-muted-foreground">
          <a href="/login" className={authLinkClass}>
            Back to sign in
          </a>
        </p>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
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
      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
      <button type="submit" disabled={isSubmitting} className={authPrimaryButtonClass}>
        {isSubmitting ? 'Sending…' : 'Send reset link'}
      </button>
      <p className="text-center text-sm text-muted-foreground">
        Remembered it?{' '}
        <a href="/login" className={authLinkClass}>
          Back to sign in
        </a>
      </p>
    </form>
  )
}
