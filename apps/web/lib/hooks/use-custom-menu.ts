'use client'

import {
  useMutation,
  useQueryClient,
  type UseMutationResult,
} from '@tanstack/react-query'
import { menuKeys } from '@weekly-food-planner/supabase'

export type CustomMenuSlotInput = {
  dayOfWeek: string
  mealKey: string
  mealType: 'breakfast' | 'lunch' | 'dinner' | 'snack'
  recipeId: string
  targetMemberId: string | null
}

export type CustomMenuInput = {
  weekStartDate: string
  durationDays: number
  slots: CustomMenuSlotInput[]
  options?: Record<string, unknown>
}

const parseError = async (response: Response, fallback: string): Promise<string> => {
  try {
    const body = (await response.json()) as { error?: string; detail?: string }
    return body.detail ?? body.error ?? fallback
  } catch {
    return fallback
  }
}

// POST /menus with mode=custom — non-deterministic, user-defined slots.
// Server validates each recipe belongs to the workspace and meal_type
// matches; allergy/dietary validation is the user's responsibility because
// they're explicitly opting into a custom plan.
export const useCustomMenu = ({
  workspaceId,
}: {
  workspaceId: string
}): UseMutationResult<{ menuId: string }, Error, CustomMenuInput> => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: CustomMenuInput) => {
      const response = await fetch(`/api/workspaces/${workspaceId}/menus`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ mode: 'custom', ...input }),
      })
      if (!response.ok) {
        throw new Error(await parseError(response, 'custom menu failed'))
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
