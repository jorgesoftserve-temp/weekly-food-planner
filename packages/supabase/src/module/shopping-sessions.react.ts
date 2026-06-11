import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
  type UseQueryResult,
} from '@tanstack/react-query'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { UpdateShoppingSessionPatch } from '../types/db.js'
import {
  getActiveShoppingSession,
  openShoppingSession,
  shoppingSessionKeys,
  updateShoppingSession,
  type ShoppingSessionRecord,
} from './shopping-sessions.js'

export const useActiveShoppingSession = ({
  supabase,
  menuId,
  enabled = true,
}: {
  supabase: SupabaseClient
  menuId: string | null
  enabled?: boolean
}): UseQueryResult<ShoppingSessionRecord | null> =>
  useQuery({
    queryKey: shoppingSessionKeys.active(menuId ?? ''),
    queryFn: () => getActiveShoppingSession({ supabase, menuId: menuId! }),
    enabled: enabled && !!menuId,
  })

export const useOpenShoppingSession = ({
  supabase,
  workspaceId,
  menuId,
}: {
  supabase: SupabaseClient
  workspaceId: string
  menuId: string
}): UseMutationResult<
  { id: string },
  Error,
  { groceryItemIds: string[]; createdBy?: string | null }
> => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ groceryItemIds, createdBy }) =>
      openShoppingSession({ supabase, workspaceId, menuId, groceryItemIds, createdBy }),
    onSuccess: () =>
      void queryClient.invalidateQueries({
        queryKey: shoppingSessionKeys.active(menuId),
      }),
  })
}

export const useUpdateShoppingSession = ({
  supabase,
  menuId,
}: {
  supabase: SupabaseClient
  menuId: string
}): UseMutationResult<
  void,
  Error,
  { sessionId: string; patch: UpdateShoppingSessionPatch }
> => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ sessionId, patch }) =>
      updateShoppingSession({ supabase, sessionId, patch }),
    onSuccess: () =>
      void queryClient.invalidateQueries({
        queryKey: shoppingSessionKeys.active(menuId),
      }),
  })
}
