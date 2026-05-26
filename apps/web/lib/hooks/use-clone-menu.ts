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

// POST /menus with mode=clone — copies the historical menu's slots into a
// fresh draft for the given week. The draft inherits the source menu's
// seed, inputs_hash, generation_options, menu_type, and duration so that
// regeneration from the dialog reproduces it.
export const useCloneMenu = ({
  workspaceId,
}: {
  workspaceId: string
}): UseMutationResult<
  { menuId: string },
  Error,
  { sourceMenuId: string; weekStartDate: string }
> => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ sourceMenuId, weekStartDate }) => {
      const response = await fetch(`/api/workspaces/${workspaceId}/menus`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          mode: 'clone',
          weekStartDate,
          cloneFromMenuId: sourceMenuId,
        }),
      })
      if (!response.ok) {
        throw new Error(await parseError(response, 'clone failed'))
      }
      const body = (await response.json()) as { menuId: string }
      return { menuId: body.menuId }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: menuKeys.draft(workspaceId),
      })
    },
  })
}
