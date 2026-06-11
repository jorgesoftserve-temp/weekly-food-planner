import {
  useMutation,
  useQueryClient,
  type UseMutationResult,
} from '@tanstack/react-query'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { UpdateShoppingItemStatusPatch } from '../types/db.js'
import { updateShoppingItemStatus } from './shopping-item-status.js'
import { shoppingSessionKeys } from './shopping-sessions.js'

// Updating one line invalidates the active-session query (keyed by menuId) so
// the completeness meter + grouped list re-derive from the fresh statuses.
export const useUpdateShoppingItemStatus = ({
  supabase,
  menuId,
}: {
  supabase: SupabaseClient
  menuId: string
}): UseMutationResult<
  void,
  Error,
  { sessionId: string; groceryItemId: string; patch: UpdateShoppingItemStatusPatch }
> => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ sessionId, groceryItemId, patch }) =>
      updateShoppingItemStatus({ supabase, sessionId, groceryItemId, patch }),
    onSuccess: () =>
      void queryClient.invalidateQueries({
        queryKey: shoppingSessionKeys.active(menuId),
      }),
  })
}
