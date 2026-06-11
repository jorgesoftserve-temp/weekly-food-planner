'use client'

import {
  useMutation,
  useQueryClient,
  type UseMutationResult,
} from '@tanstack/react-query'
import {
  menuKeys,
  slotCompletionKeys,
  type DbTypes,
} from '@weekly-food-planner/supabase'
import { menuAlertsKeys } from '@/lib/hooks/use-menu-alerts'

type SlotCookStatus = DbTypes.SlotCookStatus

const parseError = async (response: Response, fallback: string): Promise<string> => {
  try {
    const body = (await response.json()) as { error?: string; detail?: string }
    return body.detail ?? body.error ?? fallback
  } catch {
    return fallback
  }
}

// (v2.0 Phase 4) Records cook-status (planned/cooked/skipped) for an accepted-menu
// slot via the completion route, which writes slot_completions and syncs
// menu_slots.cooked_at. Refreshes the completions list, the active menu (cooked
// styling + dashboard stat), and the incomplete-shopping alerts (a cooked/skipped
// slot drops out of the alert set).
export const useSetSlotCompletion = ({
  workspaceId,
  menuId,
}: {
  workspaceId: string
  menuId: string | null
}): UseMutationResult<
  void,
  Error,
  { slotId: string; status: SlotCookStatus; notes?: string | null }
> => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ slotId, status, notes }) => {
      if (!menuId) throw new Error('no menu to record cook-status for')
      const response = await fetch(
        `/api/workspaces/${workspaceId}/menus/${menuId}/slots/${slotId}/completion`,
        {
          method: 'PATCH',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ status, notes }),
        },
      )
      if (!response.ok) {
        throw new Error(await parseError(response, 'could not update cook-status'))
      }
    },
    onSuccess: () => {
      if (menuId) {
        void queryClient.invalidateQueries({ queryKey: slotCompletionKeys.forMenu(menuId) })
        void queryClient.invalidateQueries({ queryKey: menuAlertsKeys.forMenu(workspaceId, menuId) })
      }
      void queryClient.invalidateQueries({ queryKey: menuKeys.active(workspaceId) })
    },
  })
}
