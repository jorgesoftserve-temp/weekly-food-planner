import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
  type UseQueryResult,
} from '@tanstack/react-query'
import type { SupabaseClient } from '@supabase/supabase-js'
import {
  createMember,
  getMember,
  listMembers,
  memberKeys,
  setMemberAllergies,
  setMemberDietaryRestrictions,
  setMemberIngredientDislikes,
  softDeleteMember,
  updateMember,
  type CreateMemberPayload,
  type MemberRecord,
  type UpdateMemberPatch,
} from './members.js'
import { workspaceKeys } from './workspaces.js'

export const useMembersList = ({
  supabase,
  workspaceId,
  enabled = true,
}: {
  supabase: SupabaseClient
  workspaceId: string | null
  enabled?: boolean
}): UseQueryResult<MemberRecord[]> =>
  useQuery({
    queryKey: memberKeys.list(workspaceId ?? ''),
    queryFn: () => listMembers({ supabase, workspaceId: workspaceId! }),
    enabled: enabled && !!workspaceId,
  })

export const useMemberDetail = ({
  supabase,
  workspaceId,
  memberId,
  enabled = true,
}: {
  supabase: SupabaseClient
  workspaceId: string | null
  memberId: string | null
  enabled?: boolean
}): UseQueryResult<MemberRecord | null> =>
  useQuery({
    queryKey: memberKeys.detail(workspaceId ?? '', memberId ?? ''),
    queryFn: () =>
      getMember({
        supabase,
        workspaceId: workspaceId!,
        memberId: memberId!,
      }),
    enabled: enabled && !!workspaceId && !!memberId,
  })

// On every mutation we also invalidate the workspace detail key so the
// dashboard members-card (which reads via useWorkspaceWithMembers) re-fetches
// alongside the dedicated members page.
const invalidateMemberCaches = ({
  queryClient,
  workspaceId,
  memberId,
}: {
  queryClient: ReturnType<typeof useQueryClient>
  workspaceId: string
  memberId?: string
}) => {
  void queryClient.invalidateQueries({ queryKey: memberKeys.list(workspaceId) })
  void queryClient.invalidateQueries({
    queryKey: workspaceKeys.detail(workspaceId),
  })
  if (memberId) {
    void queryClient.invalidateQueries({
      queryKey: memberKeys.detail(workspaceId, memberId),
    })
  }
}

export const useCreateMember = ({
  supabase,
  workspaceId,
}: {
  supabase: SupabaseClient
  workspaceId: string
}): UseMutationResult<{ id: string }, Error, CreateMemberPayload> => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (payload: CreateMemberPayload) =>
      createMember({ supabase, workspaceId, payload }),
    onSuccess: () => invalidateMemberCaches({ queryClient, workspaceId }),
  })
}

export const useUpdateMember = ({
  supabase,
  workspaceId,
  memberId,
}: {
  supabase: SupabaseClient
  workspaceId: string
  memberId: string
}): UseMutationResult<void, Error, UpdateMemberPatch> => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (patch: UpdateMemberPatch) =>
      updateMember({ supabase, workspaceId, memberId, patch }),
    onSuccess: () =>
      invalidateMemberCaches({ queryClient, workspaceId, memberId }),
  })
}

export const useSoftDeleteMember = ({
  supabase,
  workspaceId,
}: {
  supabase: SupabaseClient
  workspaceId: string
}): UseMutationResult<void, Error, { memberId: string }> => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ memberId }: { memberId: string }) =>
      softDeleteMember({ supabase, workspaceId, memberId }),
    onSuccess: (_data, variables) =>
      invalidateMemberCaches({
        queryClient,
        workspaceId,
        memberId: variables.memberId,
      }),
  })
}

export const useSetMemberDietaryRestrictions = ({
  supabase,
  workspaceId,
  memberId,
}: {
  supabase: SupabaseClient
  workspaceId: string
  memberId: string
}): UseMutationResult<void, Error, { values: string[] }> => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ values }) =>
      setMemberDietaryRestrictions({ supabase, memberId, values }),
    onSuccess: () =>
      invalidateMemberCaches({ queryClient, workspaceId, memberId }),
  })
}

export const useSetMemberAllergies = ({
  supabase,
  workspaceId,
  memberId,
}: {
  supabase: SupabaseClient
  workspaceId: string
  memberId: string
}): UseMutationResult<void, Error, { values: string[] }> => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ values }) =>
      setMemberAllergies({ supabase, memberId, values }),
    onSuccess: () =>
      invalidateMemberCaches({ queryClient, workspaceId, memberId }),
  })
}

export const useSetMemberIngredientDislikes = ({
  supabase,
  workspaceId,
  memberId,
}: {
  supabase: SupabaseClient
  workspaceId: string
  memberId: string
}): UseMutationResult<void, Error, { ingredientIds: string[] }> => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ ingredientIds }) =>
      setMemberIngredientDislikes({ supabase, memberId, ingredientIds }),
    onSuccess: () =>
      invalidateMemberCaches({ queryClient, workspaceId, memberId }),
  })
}
