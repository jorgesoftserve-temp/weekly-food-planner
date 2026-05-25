import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
  type UseQueryResult,
} from '@tanstack/react-query'
import type { SupabaseClient } from '@supabase/supabase-js'
import {
  getWorkspaceWithMembers,
  listWorkspacesForUser,
  updateWorkspace,
  workspaceKeys,
  type UpdateWorkspacePatch,
  type WorkspaceListEntry,
  type WorkspaceWithMembers,
} from './workspaces.js'

export const useWorkspacesForUser = ({
  supabase,
  userId,
  enabled = true,
}: {
  supabase: SupabaseClient
  userId: string | null
  enabled?: boolean
}): UseQueryResult<WorkspaceListEntry[]> =>
  useQuery({
    queryKey: workspaceKeys.listForUser(),
    queryFn: () => listWorkspacesForUser({ supabase, userId: userId! }),
    enabled: enabled && !!userId,
  })

export const useWorkspaceWithMembers = ({
  supabase,
  workspaceId,
  enabled = true,
}: {
  supabase: SupabaseClient
  workspaceId: string | null
  enabled?: boolean
}): UseQueryResult<WorkspaceWithMembers | null> =>
  useQuery({
    queryKey: workspaceKeys.detail(workspaceId ?? ''),
    queryFn: () => getWorkspaceWithMembers({ supabase, workspaceId: workspaceId! }),
    enabled: enabled && !!workspaceId,
  })

export const useUpdateWorkspace = ({
  supabase,
  workspaceId,
}: {
  supabase: SupabaseClient
  workspaceId: string
}): UseMutationResult<void, Error, UpdateWorkspacePatch> => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (patch: UpdateWorkspacePatch) =>
      updateWorkspace({ supabase, workspaceId, patch }),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: workspaceKeys.detail(workspaceId),
      })
      void queryClient.invalidateQueries({
        queryKey: workspaceKeys.listForUser(),
      })
    },
  })
}
