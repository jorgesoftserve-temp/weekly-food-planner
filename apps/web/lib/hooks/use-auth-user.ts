'use client'

import { useQuery, type UseQueryResult } from '@tanstack/react-query'
import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import type { User } from '@supabase/supabase-js'
import { useSupabase } from './use-supabase'

const AUTH_USER_KEY = ['auth', 'user'] as const

export const useAuthUser = (): UseQueryResult<User | null> => {
  const supabase = useSupabase()
  const queryClient = useQueryClient()

  // Keep the auth-user cache in sync with Supabase's auth state machine so
  // login/logout/refresh events flow through React Query without manual
  // invalidation in every form.
  useEffect(() => {
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      queryClient.setQueryData(AUTH_USER_KEY, session?.user ?? null)
    })
    return () => {
      listener.subscription.unsubscribe()
    }
  }, [supabase, queryClient])

  return useQuery({
    queryKey: AUTH_USER_KEY,
    queryFn: async () => {
      const { data, error } = await supabase.auth.getUser()
      if (error) {
        // AuthSessionMissingError is the normal "not logged in" state — treat as null.
        return null
      }
      return data.user ?? null
    },
    staleTime: Infinity,
  })
}
