import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
  type UseQueryResult,
} from '@tanstack/react-query'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { AccentColor } from '../types/db.js'
import {
  getProfile,
  profileKeys,
  updateAccentColor,
  type ProfileRecord,
} from './profiles.js'

export const useProfile = ({
  supabase,
  userId,
  enabled = true,
}: {
  supabase: SupabaseClient
  userId: string | null
  enabled?: boolean
}): UseQueryResult<ProfileRecord | null> =>
  useQuery({
    queryKey: profileKeys.detail(userId ?? ''),
    queryFn: () => getProfile({ supabase, userId: userId! }),
    enabled: enabled && !!userId,
  })

export const useUpdateAccentColor = ({
  supabase,
  userId,
}: {
  supabase: SupabaseClient
  userId: string
}): UseMutationResult<void, Error, { accentColor: AccentColor }> => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ accentColor }) =>
      updateAccentColor({ supabase, userId, accentColor }),
    onSuccess: () =>
      void queryClient.invalidateQueries({
        queryKey: profileKeys.detail(userId),
      }),
  })
}
