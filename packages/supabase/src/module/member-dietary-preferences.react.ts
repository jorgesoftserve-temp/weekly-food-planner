import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
  type UseQueryResult,
} from '@tanstack/react-query'
import type { SupabaseClient } from '@supabase/supabase-js'
import {
  addMemberDietaryPreference,
  getMemberDietaryPreferences,
  memberDietaryPreferenceKeys,
  removeMemberDietaryPreference,
  setMemberDietaryPreferences,
  type MemberDietaryPreferenceRecord,
} from './member-dietary-preferences.js'
import { memberKeys } from './members.js'
import type { CreateMemberDietaryPreferencePayload, PreferenceKind } from '../types/db.js'

export const useMemberDietaryPreferences = ({
  supabase,
  workspaceId,
  memberId,
  enabled = true,
}: {
  supabase: SupabaseClient
  workspaceId: string | null
  memberId: string | null
  enabled?: boolean
}): UseQueryResult<MemberDietaryPreferenceRecord[]> =>
  useQuery({
    queryKey: memberDietaryPreferenceKeys.forMember(workspaceId ?? '', memberId ?? ''),
    queryFn: () =>
      getMemberDietaryPreferences({
        supabase,
        workspaceId: workspaceId!,
        memberId: memberId!,
      }),
    enabled: enabled && !!workspaceId && !!memberId,
  })

export const useAddMemberDietaryPreference = ({
  supabase,
  workspaceId,
  memberId,
}: {
  supabase: SupabaseClient
  workspaceId: string
  memberId: string
}): UseMutationResult<MemberDietaryPreferenceRecord, Error, CreateMemberDietaryPreferencePayload> => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (payload: CreateMemberDietaryPreferencePayload) =>
      addMemberDietaryPreference({ supabase, payload }),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: memberDietaryPreferenceKeys.forMember(workspaceId, memberId),
      })
      void queryClient.invalidateQueries({
        queryKey: memberKeys.detail(workspaceId, memberId),
      })
    },
  })
}

export const useRemoveMemberDietaryPreference = ({
  supabase,
  workspaceId,
  memberId,
}: {
  supabase: SupabaseClient
  workspaceId: string
  memberId: string
}): UseMutationResult<void, Error, { preferenceId: string }> => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ preferenceId }: { preferenceId: string }) =>
      removeMemberDietaryPreference({ supabase, preferenceId }),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: memberDietaryPreferenceKeys.forMember(workspaceId, memberId),
      })
      void queryClient.invalidateQueries({
        queryKey: memberKeys.detail(workspaceId, memberId),
      })
    },
  })
}

export const useSetMemberDietaryPreferences = ({
  supabase,
  workspaceId,
  memberId,
}: {
  supabase: SupabaseClient
  workspaceId: string
  memberId: string
}): UseMutationResult<void, Error, { kind: PreferenceKind; values: string[] }> => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ kind, values }: { kind: PreferenceKind; values: string[] }) =>
      setMemberDietaryPreferences({ supabase, workspaceId, memberId, kind, values }),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: memberDietaryPreferenceKeys.forMember(workspaceId, memberId),
      })
      void queryClient.invalidateQueries({
        queryKey: memberKeys.detail(workspaceId, memberId),
      })
    },
  })
}
