'use client'

import { useRouter } from 'next/navigation'
import { LogOut, User as UserIcon } from 'lucide-react'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useAuthUser } from '@/lib/hooks/use-auth-user'
import { useSupabase } from '@/lib/hooks/use-supabase'
import { notifyError } from '@/lib/toast'

const initialsFor = (email: string | undefined): string => {
  if (!email) return '?'
  const [local] = email.split('@')
  if (!local) return '?'
  const parts = local.split(/[._-]/).filter(Boolean)
  if (parts.length === 0) return local.charAt(0).toUpperCase()
  const first = parts[0]?.charAt(0) ?? ''
  const last = parts.length > 1 ? parts[parts.length - 1]?.charAt(0) ?? '' : ''
  return (first + last).toUpperCase()
}

export const UserMenu = () => {
  const router = useRouter()
  const supabase = useSupabase()
  const { data: user } = useAuthUser()

  const handleLogout = async () => {
    const { error } = await supabase.auth.signOut()
    if (error) {
      notifyError('Sign out failed', error.message)
      return
    }
    router.replace('/login')
    router.refresh()
  }

  const email = user?.email ?? undefined
  const initials = initialsFor(email)

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Account menu"
          className="rounded-full"
        >
          <Avatar className="size-8">
            <AvatarFallback>{initials}</AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="flex flex-col gap-0.5">
          <span className="flex items-center gap-1.5 text-xs font-normal text-muted-foreground">
            <UserIcon className="size-3" />
            Signed in as
          </span>
          <span className="truncate text-sm font-medium">
            {email ?? 'Loading…'}
          </span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={(event) => {
            event.preventDefault()
            void handleLogout()
          }}
        >
          <LogOut className="mr-2 size-4" />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
