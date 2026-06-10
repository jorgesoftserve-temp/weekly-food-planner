'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState, type FormEvent } from 'react'
import { supabaseClient } from '@/utils/supabase/client'
import {
  authInputClass,
  authLinkClass,
  authPrimaryButtonClass,
} from '../_components/auth-ui'

type FormState = {
  password: string
  confirm: string
}

const initialState: FormState = { password: '', confirm: '' }

// The recovery session is established by /auth/callback exchanging the magic
// link's `code`. If the user lands here without a session (link expired,
// pasted URL into a fresh browser), we surface a clear path back rather than
// silently failing on updateUser().
export const ResetPasswordForm = () => {
  const router = useRouter()
  const [form, setForm] = useState<FormState>(initialState)
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [hasSession, setHasSession] = useState<boolean | null>(null)

  useEffect(() => {
    const supabase = supabaseClient()
    supabase.auth.getSession().then(({ data }) => {
      setHasSession(!!data.session)
    })
  }, [])

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)
    if (form.password !== form.confirm) {
      setError("Passwords don't match.")
      return
    }
    if (form.password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }
    setIsSubmitting(true)
    const supabase = supabaseClient()
    const { error: updateError } = await supabase.auth.updateUser({
      password: form.password,
    })
    setIsSubmitting(false)
    if (updateError) {
      setError(updateError.message)
      return
    }
    router.push('/login?reset=1')
    router.refresh()
  }

  if (hasSession === false) {
    return (
      <div className="flex flex-col gap-3 text-sm">
        <p>
          This reset link is no longer valid. Links expire after a short window
          for security.
        </p>
        <p className="text-muted-foreground">
          <a href="/forgot-password" className={authLinkClass}>
            Request a new reset link
          </a>
        </p>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <label className="flex flex-col gap-1.5 text-sm font-medium">
        New password
        <input
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          value={form.password}
          onChange={(event) =>
            setForm((prev) => ({ ...prev, password: event.target.value }))
          }
          className={authInputClass}
        />
      </label>
      <label className="flex flex-col gap-1.5 text-sm font-medium">
        Confirm new password
        <input
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          value={form.confirm}
          onChange={(event) =>
            setForm((prev) => ({ ...prev, confirm: event.target.value }))
          }
          className={authInputClass}
        />
      </label>
      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={isSubmitting || hasSession === null}
        className={authPrimaryButtonClass}
      >
        {isSubmitting ? 'Updating…' : 'Update password'}
      </button>
    </form>
  )
}
