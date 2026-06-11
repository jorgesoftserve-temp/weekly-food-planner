'use client'

import {
  useMutation,
  useQueryClient,
  type UseMutationResult,
} from '@tanstack/react-query'
import {
  groceryKeys,
  menuKeys,
  menuSlotOverrideKeys,
  type DbTypes,
} from '@weekly-food-planner/supabase'
import { menuAlertsKeys } from '@/lib/hooks/use-menu-alerts'

type Unit = DbTypes.Unit

const parseError = async (response: Response, fallback: string): Promise<string> => {
  try {
    const body = (await response.json()) as { error?: string; detail?: string }
    return body.detail ?? body.error ?? fallback
  } catch {
    return fallback
  }
}

const invalidate = ({
  queryClient,
  workspaceId,
  menuId,
}: {
  queryClient: ReturnType<typeof useQueryClient>
  workspaceId: string
  menuId: string | null
}) => {
  if (menuId) {
    void queryClient.invalidateQueries({ queryKey: menuSlotOverrideKeys.forMenu(menuId) })
    void queryClient.invalidateQueries({ queryKey: menuAlertsKeys.forMenu(workspaceId, menuId) })
    void queryClient.invalidateQueries({ queryKey: groceryKeys.byMenuId(workspaceId, menuId) })
  }
  // The substitution changes the grocery aggregation, so refresh the active list.
  void queryClient.invalidateQueries({ queryKey: groceryKeys.active(workspaceId) })
  void queryClient.invalidateQueries({ queryKey: menuKeys.active(workspaceId) })
}

// (v2.0 Phase 6) Set/replace an ingredient substitution on an accepted-menu slot.
// The route validates the substitute against the slot eaters and re-runs grocery
// recompute; on success we invalidate the override list + grocery + alerts.
export const useSetSlotIngredientOverride = ({
  workspaceId,
  menuId,
}: {
  workspaceId: string
  menuId: string | null
}): UseMutationResult<
  void,
  Error,
  {
    slotId: string
    original_ingredient_id: string
    substitute_ingredient_id: string
    quantity?: number | null
    unit?: Unit | null
    note?: string | null
  }
> => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ slotId, ...body }) => {
      if (!menuId) throw new Error('no menu to substitute on')
      const response = await fetch(
        `/api/workspaces/${workspaceId}/menus/${menuId}/slots/${slotId}/ingredient-overrides`,
        {
          method: 'PUT',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(body),
        },
      )
      if (!response.ok) {
        throw new Error(await parseError(response, 'could not substitute ingredient'))
      }
    },
    onSuccess: () => invalidate({ queryClient, workspaceId, menuId }),
  })
}

// Remove a substitution, restoring the recipe's original ingredient.
export const useDeleteSlotIngredientOverride = ({
  workspaceId,
  menuId,
}: {
  workspaceId: string
  menuId: string | null
}): UseMutationResult<
  void,
  Error,
  { slotId: string; original_ingredient_id: string }
> => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ slotId, original_ingredient_id }) => {
      if (!menuId) throw new Error('no menu to substitute on')
      const response = await fetch(
        `/api/workspaces/${workspaceId}/menus/${menuId}/slots/${slotId}/ingredient-overrides`,
        {
          method: 'DELETE',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ original_ingredient_id }),
        },
      )
      if (!response.ok) {
        throw new Error(await parseError(response, 'could not remove substitution'))
      }
    },
    onSuccess: () => invalidate({ queryClient, workspaceId, menuId }),
  })
}
