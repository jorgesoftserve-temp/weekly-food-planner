'use client'

import { useAuthUser } from '@/lib/hooks/use-auth-user'
import { Skeleton } from '@/components/ui/skeleton'

// Cozy identity band at the top of Settings — gradient avatar + name + email,
// mirroring the design-lab profile mock. Read-only; editing lives in the cards
// below. Initial/name derive from user_metadata.display_name, falling back to
// the email local-part so the avatar is never blank.
export const IdentityHeader = () => {
  const { data: user, isLoading } = useAuthUser()

  if (isLoading) {
    return (
      <div className="flex items-center gap-4 rounded-2xl border border-border bg-gradient-hero p-5 shadow-sm">
        <Skeleton className="size-16 rounded-full" />
        <div className="flex flex-col gap-2">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-4 w-52" />
        </div>
      </div>
    )
  }

  const email = user?.email ?? ''
  const displayName =
    (user?.user_metadata?.display_name as string | undefined)?.trim() || null
  const name = displayName ?? (email ? email.split('@')[0] : 'Your account')
  const initial = (name?.charAt(0) ?? 'U').toUpperCase()

  return (
    <div className="flex items-center gap-4 rounded-2xl border border-border bg-gradient-hero p-5 shadow-sm">
      <div className="flex size-16 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary to-secondary text-2xl font-semibold text-white">
        {initial}
      </div>
      <div className="min-w-0">
        <h2 className="truncate text-xl font-semibold tracking-tight">{name}</h2>
        {email ? (
          <p className="truncate text-sm text-muted-foreground">{email}</p>
        ) : null}
      </div>
    </div>
  )
}
