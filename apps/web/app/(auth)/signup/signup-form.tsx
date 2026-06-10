'use client'

import { useRouter } from 'next/navigation'
import { useState, type FormEvent } from 'react'
import { supabaseClient } from '@/utils/supabase/client'
import {
  authInputClass,
  authLinkClass,
  authPrimaryButtonClass,
} from '../_components/auth-ui'

type FormState = {
  email: string
  password: string
}

const initialState: FormState = { email: '', password: '' }

export const SignupForm = () => {
  const router = useRouter()
  const [form, setForm] = useState<FormState>(initialState)
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)
    setIsSubmitting(true)
    const supabase = supabaseClient()
    const redirectTo = `${window.location.origin}/auth/callback?next=/verify-success`
    const { error: signUpError } = await supabase.auth.signUp({
      email: form.email,
      password: form.password,
      options: { emailRedirectTo: redirectTo },
    })
    setIsSubmitting(false)
    if (signUpError) {
      setError(signUpError.message)
      return
    }
    // Stash the email so /verify-email can offer a one-click resend without
    // re-asking. sessionStorage scopes it to this tab; cleared on tab close.
    try {
      window.sessionStorage.setItem('wfp:pending-verify-email', form.email)
    } catch {
      // sessionStorage unavailable (privacy mode) — resend will degrade
      // gracefully to a "sign up again" link on /verify-email.
    }
    router.push('/verify-email')
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
      <label className="flex flex-col gap-1.5 text-sm font-medium">
        Password
        <input
          type="password"
          required
          minLength={8}
          value={form.password}
          onChange={(event) =>
            setForm((prev) => ({ ...prev, password: event.target.value }))
          }
          className={authInputClass}
        />
        <span className="text-xs font-normal text-muted-foreground">
          At least 8 characters.
        </span>
      </label>
      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
      <button type="submit" disabled={isSubmitting} className={authPrimaryButtonClass}>
        {isSubmitting ? 'Creating account…' : 'Create account'}
      </button>
      <p className="text-center text-sm text-muted-foreground">
        Already have an account?{' '}
        <a href="/login" className={authLinkClass}>
          Sign in
        </a>
      </p>
    </form>
  )
}
