'use client'

import {
  useMutation,
  useQueryClient,
  type UseMutationResult,
} from '@tanstack/react-query'
import { inventoryKeys, type DbTypes } from '@weekly-food-planner/supabase'

type Unit = DbTypes.Unit

export type LeftoverLine = {
  ingredient_id: string
  quantity: number
  unit: Unit
}

const parseError = async (response: Response, fallback: string): Promise<string> => {
  try {
    const body = (await response.json()) as { error?: string; detail?: string }
    return body.detail ?? body.error ?? fallback
  } catch {
    return fallback
  }
}

// (v2.0 Phase 5) Creates cook-time leftovers for an accepted-menu slot via the
// leftovers route (raw-ingredient remainders → cook_remainder, prepared-dish
// surplus → leftover). Refreshes the inventory list so the new pantry rows
// appear immediately.
export const useCreateCookLeftovers = ({
  workspaceId,
  menuId,
}: {
  workspaceId: string
  menuId: string | null
}): UseMutationResult<
  { createdCount: number },
  Error,
  {
    slotId: string
    label?: string | null
    remainders?: LeftoverLine[]
    surplus?: LeftoverLine[]
  }
> => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ slotId, label, remainders, surplus }) => {
      if (!menuId) throw new Error('no menu to record leftovers for')
      const response = await fetch(
        `/api/workspaces/${workspaceId}/menus/${menuId}/slots/${slotId}/leftovers`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ label, remainders, surplus }),
        },
      )
      if (!response.ok) {
        throw new Error(await parseError(response, 'could not save leftovers'))
      }
      return (await response.json()) as { createdCount: number }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: inventoryKeys.list(workspaceId) })
    },
  })
}
