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

export type GenerateMenuInput = {
  weekStartDate: string
  seed?: number
  options?: {
    additionalDietaryRestrictions?: string[]
    additionalAllergies?: string[]
    ingredientExclusions?: string[]
    calorieTolerance?: number
    repetitionLimit?: number
    preferredCuisines?: string[]
  }
}

export type GenerateMenuSuccess = {
  ok: true
  menuId: string
  inputsHash: string
  seed: number
  effectiveOverlay: NonNullable<GenerateMenuInput['options']>
  menu: unknown
  groceryLists: unknown
}

export type GenerateMenuFailure = {
  ok: false
  error: {
    // Engine reasonCodes are UPPERCASE_SNAKE (NO_SLOTS, NO_CANDIDATES,
    // ALL_MEALS_PASSED, etc.); the typed alternation here is for IntelliSense,
    // the wire is open string.
    reasonCode: string
    humanMessage?: string
    failedConstraint?: string
    affectedMemberId?: string | null
    affectedMemberName?: string | null
    affectedMeal?: { day: string; mealKey: string } | null
  }
  generationRunId?: string
}

export type GenerateMenuResponse = GenerateMenuSuccess | GenerateMenuFailure

export class GenerateMenuError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code?: string,
  ) {
    super(message)
    this.name = 'GenerateMenuError'
  }
}

const postGenerateMenu = async ({
  workspaceId,
  input,
}: {
  workspaceId: string
  input: GenerateMenuInput
}): Promise<GenerateMenuResponse> => {
  const response = await fetch(`/api/workspaces/${workspaceId}/menus`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(input),
  })
  // 200 OK = success; 422 = engine returned a failure but the run was audited;
  // 4xx other = pre-engine error (auth, empty workspace, bad payload).
  if (response.status === 200 || response.status === 422) {
    return (await response.json()) as GenerateMenuResponse
  }
  const detail = await response.text().catch(() => '')
  throw new GenerateMenuError(
    detail || `menu generation failed with status ${response.status}`,
    response.status,
  )
}

export const useGenerateMenu = ({
  workspaceId,
}: {
  workspaceId: string
}): UseMutationResult<GenerateMenuResponse, Error, GenerateMenuInput> => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: GenerateMenuInput) =>
      postGenerateMenu({ workspaceId, input }),
    onSuccess: (data) => {
      if (data.ok) {
        void queryClient.invalidateQueries({
          queryKey: menuKeys.active(workspaceId),
        })
        void queryClient.invalidateQueries({
          queryKey: groceryKeys.active(workspaceId),
        })
      }
    },
  })
}
