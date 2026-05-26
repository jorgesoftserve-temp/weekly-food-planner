'use client'

import {
  useMutation,
  useQueryClient,
  type UseMutationResult,
} from '@tanstack/react-query'
import {
  groceryKeys,
  menuKeys,
} from '@weekly-food-planner/supabase'

type DraftMutationContext = { workspaceId: string }

const parseError = async (response: Response, fallback: string): Promise<string> => {
  try {
    const body = (await response.json()) as { error?: string; detail?: string }
    return body.detail ?? body.error ?? fallback
  } catch {
    return fallback
  }
}

export type AddSlotInput = {
  dayOfWeek: string
  mealType: 'breakfast' | 'lunch' | 'dinner' | 'snack'
  recipeId: string
  targetMemberId: string | null
}

export const useAddMenuSlot = ({
  workspaceId,
  menuId,
}: {
  workspaceId: string
  menuId: string | null
}): UseMutationResult<void, Error, AddSlotInput, DraftMutationContext> => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: AddSlotInput) => {
      if (!menuId) throw new Error('no draft menu to add to')
      const response = await fetch(
        `/api/workspaces/${workspaceId}/menus/${menuId}/slots`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(input),
        },
      )
      if (!response.ok) {
        throw new Error(await parseError(response, 'add slot failed'))
      }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: menuKeys.draft(workspaceId),
      })
    },
  })
}

export const useReplaceMenuSlot = ({
  workspaceId,
  menuId,
}: {
  workspaceId: string
  menuId: string | null
}): UseMutationResult<
  void,
  Error,
  { slotId: string; recipeId: string },
  DraftMutationContext
> => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ slotId, recipeId }) => {
      if (!menuId) throw new Error('no draft menu to edit')
      const response = await fetch(
        `/api/workspaces/${workspaceId}/menus/${menuId}/slots/${slotId}`,
        {
          method: 'PATCH',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ action: 'replace', recipeId }),
        },
      )
      if (!response.ok) {
        throw new Error(await parseError(response, 'slot replace failed'))
      }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: menuKeys.draft(workspaceId),
      })
    },
  })
}

export const useAcceptMenuDraft = ({
  workspaceId,
}: {
  workspaceId: string
}): UseMutationResult<void, Error, { menuId: string }, DraftMutationContext> => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ menuId }) => {
      const response = await fetch(
        `/api/workspaces/${workspaceId}/menus/${menuId}/accept`,
        { method: 'POST' },
      )
      if (!response.ok) {
        throw new Error(await parseError(response, 'accept failed'))
      }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: menuKeys.draft(workspaceId),
      })
      void queryClient.invalidateQueries({
        queryKey: menuKeys.active(workspaceId),
      })
      void queryClient.invalidateQueries({
        queryKey: menuKeys.upcoming(workspaceId),
      })
      void queryClient.invalidateQueries({
        queryKey: menuKeys.history(workspaceId),
      })
      void queryClient.invalidateQueries({
        queryKey: groceryKeys.active(workspaceId),
      })
    },
  })
}

export const useDiscardMenuDraft = ({
  workspaceId,
}: {
  workspaceId: string
}): UseMutationResult<void, Error, { menuId: string }, DraftMutationContext> => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ menuId }) => {
      const response = await fetch(
        `/api/workspaces/${workspaceId}/menus/${menuId}`,
        { method: 'DELETE' },
      )
      if (!response.ok) {
        throw new Error(await parseError(response, 'discard failed'))
      }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: menuKeys.draft(workspaceId),
      })
    },
  })
}
