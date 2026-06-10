'use client'

import {
  useMutation,
  useQueryClient,
  type UseMutationResult,
} from '@tanstack/react-query'
import { menuKeys } from '@weekly-food-planner/supabase'

const parseError = async (response: Response, fallback: string): Promise<string> => {
  try {
    const body = (await response.json()) as { error?: string; detail?: string }
    return body.detail ?? body.error ?? fallback
  } catch {
    return fallback
  }
}

// Toggles cook-mode completion on a single accepted-menu slot. Posts to the
// caller-context cook route (cooked_at is server-set) and refreshes the active
// menu so MenuView + the dashboard "cooked this week" stat re-render.
export const useMarkSlotCooked = ({
  workspaceId,
  menuId,
}: {
  workspaceId: string
  menuId: string | null
}): UseMutationResult<void, Error, { slotId: string; cooked: boolean }> => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ slotId, cooked }) => {
      if (!menuId) throw new Error('no menu to cook from')
      const response = await fetch(
        `/api/workspaces/${workspaceId}/menus/${menuId}/slots/${slotId}/cook`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ cooked }),
        },
      )
      if (!response.ok) {
        throw new Error(await parseError(response, 'could not update cooked state'))
      }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: menuKeys.active(workspaceId),
      })
    },
  })
}
