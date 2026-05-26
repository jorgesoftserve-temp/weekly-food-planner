'use client'

import { useEffect, useState, type FormEvent } from 'react'
import { Loader2 } from 'lucide-react'
import { useAuthUser } from '@/lib/hooks/use-auth-user'
import { useSupabase } from '@/lib/hooks/use-supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { notifyError, notifySuccess } from '@/lib/toast'

// We don't ask for the current password — Supabase doesn't verify it server-
// side on updateUser, and the user is already authenticated. If a session
// hijack were a real concern we'd require re-auth before this form; for the
// MVP the active-session guarantee is enough. Documented as a follow-up.

export const SettingsForm = () => {
  const supabase = useSupabase()
  const { data: user, isLoading: userLoading } = useAuthUser()

  const [displayName, setDisplayName] = useState('')
  const [profileSaving, setProfileSaving] = useState(false)
  const [password, setPassword] = useState('')
  const [passwordConfirm, setPasswordConfirm] = useState('')
  const [passwordSaving, setPasswordSaving] = useState(false)

  // Seed the field once the auth user lands. user_metadata.display_name is
  // freeform — Supabase doesn't validate it; treat missing as empty string.
  useEffect(() => {
    if (user) {
      const stored = (user.user_metadata?.display_name as string | undefined) ?? ''
      setDisplayName(stored)
    }
  }, [user])

  const handleProfileSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setProfileSaving(true)
    const { error } = await supabase.auth.updateUser({
      data: { display_name: displayName.trim() || null },
    })
    setProfileSaving(false)
    if (error) {
      notifyError('Profile update failed', error.message)
      return
    }
    notifySuccess('Profile saved', 'Your display name has been updated.')
  }

  const handlePasswordSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (password.length < 8) {
      notifyError('Password too short', 'Use at least 8 characters.')
      return
    }
    if (password !== passwordConfirm) {
      notifyError('Passwords do not match', 'Re-enter the same password in both fields.')
      return
    }
    setPasswordSaving(true)
    const { error } = await supabase.auth.updateUser({ password })
    setPasswordSaving(false)
    if (error) {
      notifyError('Password update failed', error.message)
      return
    }
    setPassword('')
    setPasswordConfirm('')
    notifySuccess('Password updated', 'Your new password is active.')
  }

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Profile</CardTitle>
          <CardDescription>
            Email: <span className="font-mono">{userLoading ? '…' : user?.email ?? '—'}</span>
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleProfileSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="display_name">Display name</Label>
              <Input
                id="display_name"
                value={displayName}
                onChange={(event) => setDisplayName(event.target.value)}
                placeholder="How should we address you?"
                disabled={userLoading}
              />
            </div>
            <div className="flex justify-end">
              <Button type="submit" disabled={profileSaving || userLoading}>
                {profileSaving ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    Saving…
                  </>
                ) : (
                  'Save profile'
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Change password</CardTitle>
          <CardDescription>
            Minimum 8 characters. The new password takes effect immediately.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handlePasswordSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="new_password">New password</Label>
              <Input
                id="new_password"
                type="password"
                minLength={8}
                required
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="new-password"
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="confirm_password">Confirm new password</Label>
              <Input
                id="confirm_password"
                type="password"
                minLength={8}
                required
                value={passwordConfirm}
                onChange={(event) => setPasswordConfirm(event.target.value)}
                autoComplete="new-password"
              />
            </div>
            <div className="flex justify-end">
              <Button
                type="submit"
                disabled={
                  passwordSaving || password.length < 8 || password !== passwordConfirm
                }
              >
                {passwordSaving ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    Updating…
                  </>
                ) : (
                  'Update password'
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
