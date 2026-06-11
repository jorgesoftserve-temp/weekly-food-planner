import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
  type UseQueryResult,
} from '@tanstack/react-query'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { UpdateInventoryItemPatch } from '../types/db.js'
import {
  createInventoryItem,
  deleteInventoryItem,
  inventoryKeys,
  listInventoryItems,
  updateInventoryItem,
  type CreateInventoryItemInput,
  type InventoryItemRecord,
} from './inventory-items.js'

export const useInventoryList = ({
  supabase,
  workspaceId,
  includeConsumed = false,
  enabled = true,
}: {
  supabase: SupabaseClient
  workspaceId: string | null
  includeConsumed?: boolean
  enabled?: boolean
}): UseQueryResult<InventoryItemRecord[]> =>
  useQuery({
    queryKey: inventoryKeys.list(workspaceId ?? ''),
    queryFn: () =>
      listInventoryItems({
        supabase,
        workspaceId: workspaceId!,
        includeConsumed,
      }),
    enabled: enabled && !!workspaceId,
  })

const invalidateInventory = ({
  queryClient,
  workspaceId,
}: {
  queryClient: ReturnType<typeof useQueryClient>
  workspaceId: string
}) => {
  void queryClient.invalidateQueries({ queryKey: inventoryKeys.list(workspaceId) })
}

export const useCreateInventoryItem = ({
  supabase,
  workspaceId,
}: {
  supabase: SupabaseClient
  workspaceId: string
}): UseMutationResult<{ id: string }, Error, CreateInventoryItemInput> => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (payload: CreateInventoryItemInput) =>
      createInventoryItem({ supabase, workspaceId, payload }),
    onSuccess: () => invalidateInventory({ queryClient, workspaceId }),
  })
}

export const useUpdateInventoryItem = ({
  supabase,
  workspaceId,
}: {
  supabase: SupabaseClient
  workspaceId: string
}): UseMutationResult<
  void,
  Error,
  { itemId: string; patch: UpdateInventoryItemPatch }
> => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ itemId, patch }) =>
      updateInventoryItem({ supabase, workspaceId, itemId, patch }),
    onSuccess: () => invalidateInventory({ queryClient, workspaceId }),
  })
}

export const useDeleteInventoryItem = ({
  supabase,
  workspaceId,
}: {
  supabase: SupabaseClient
  workspaceId: string
}): UseMutationResult<void, Error, { itemId: string }> => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ itemId }) =>
      deleteInventoryItem({ supabase, workspaceId, itemId }),
    onSuccess: () => invalidateInventory({ queryClient, workspaceId }),
  })
}
