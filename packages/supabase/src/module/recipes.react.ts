import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
  type UseQueryResult,
} from '@tanstack/react-query'
import type { SupabaseClient } from '@supabase/supabase-js'
import {
  createRecipe,
  createRecipesBulk,
  getRecipe,
  listRecipes,
  recipeKeys,
  replaceRecipeDietaryTags,
  replaceRecipeIngredients,
  replaceRecipeInstructions,
  replaceRecipeMealTypes,
  softDeleteRecipe,
  updateRecipe,
  type CreateRecipePayload,
  type RecipeIngredientInput,
  type RecipeInstructionInput,
  type RecipeRecord,
  type UpdateRecipePatch,
} from './recipes.js'
import type { MealType } from '../types/db.js'

export const useRecipesList = ({
  supabase,
  workspaceId,
  enabled = true,
}: {
  supabase: SupabaseClient
  workspaceId: string | null
  enabled?: boolean
}): UseQueryResult<RecipeRecord[]> =>
  useQuery({
    queryKey: recipeKeys.list(workspaceId ?? ''),
    queryFn: () => listRecipes({ supabase, workspaceId: workspaceId! }),
    enabled: enabled && !!workspaceId,
  })

export const useRecipeDetail = ({
  supabase,
  workspaceId,
  recipeId,
  enabled = true,
}: {
  supabase: SupabaseClient
  workspaceId: string | null
  recipeId: string | null
  enabled?: boolean
}): UseQueryResult<RecipeRecord | null> =>
  useQuery({
    queryKey: recipeKeys.detail(workspaceId ?? '', recipeId ?? ''),
    queryFn: () =>
      getRecipe({
        supabase,
        workspaceId: workspaceId!,
        recipeId: recipeId!,
      }),
    enabled: enabled && !!workspaceId && !!recipeId,
  })

export const useCreateRecipe = ({
  supabase,
  workspaceId,
}: {
  supabase: SupabaseClient
  workspaceId: string
}): UseMutationResult<{ id: string }, Error, CreateRecipePayload> => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (payload: CreateRecipePayload) =>
      createRecipe({ supabase, workspaceId, payload }),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: recipeKeys.list(workspaceId),
      })
    },
  })
}

// (v2.1 Track E) Bulk-create N recipes + all child rows in one compensated batch.
export const useCreateRecipesBulk = ({
  supabase,
  workspaceId,
}: {
  supabase: SupabaseClient
  workspaceId: string
}): UseMutationResult<{ ids: string[] }, Error, { recipes: CreateRecipePayload[] }> => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ recipes }: { recipes: CreateRecipePayload[] }) =>
      createRecipesBulk({ supabase, workspaceId, recipes }),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: recipeKeys.list(workspaceId),
      })
    },
  })
}

export const useUpdateRecipe = ({
  supabase,
  workspaceId,
  recipeId,
}: {
  supabase: SupabaseClient
  workspaceId: string
  recipeId: string
}): UseMutationResult<void, Error, UpdateRecipePatch> => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (patch: UpdateRecipePatch) =>
      updateRecipe({ supabase, workspaceId, recipeId, patch }),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: recipeKeys.list(workspaceId),
      })
      void queryClient.invalidateQueries({
        queryKey: recipeKeys.detail(workspaceId, recipeId),
      })
    },
  })
}

export const useSoftDeleteRecipe = ({
  supabase,
  workspaceId,
}: {
  supabase: SupabaseClient
  workspaceId: string
}): UseMutationResult<void, Error, { recipeId: string }> => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ recipeId }: { recipeId: string }) =>
      softDeleteRecipe({ supabase, workspaceId, recipeId }),
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({
        queryKey: recipeKeys.list(workspaceId),
      })
      void queryClient.invalidateQueries({
        queryKey: recipeKeys.detail(workspaceId, variables.recipeId),
      })
    },
  })
}

// Array-replace mutations. Each invalidates both list + detail so the form
// re-hydrates with the post-save state if it stays mounted.

export const useReplaceRecipeIngredients = ({
  supabase,
  workspaceId,
  recipeId,
}: {
  supabase: SupabaseClient
  workspaceId: string
  recipeId: string
}): UseMutationResult<void, Error, { ingredients: RecipeIngredientInput[] }> => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ ingredients }) =>
      replaceRecipeIngredients({ supabase, recipeId, ingredients }),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: recipeKeys.list(workspaceId),
      })
      void queryClient.invalidateQueries({
        queryKey: recipeKeys.detail(workspaceId, recipeId),
      })
    },
  })
}

export const useReplaceRecipeInstructions = ({
  supabase,
  workspaceId,
  recipeId,
}: {
  supabase: SupabaseClient
  workspaceId: string
  recipeId: string
}): UseMutationResult<
  void,
  Error,
  { instructions: RecipeInstructionInput[] }
> => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ instructions }) =>
      replaceRecipeInstructions({ supabase, recipeId, instructions }),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: recipeKeys.list(workspaceId),
      })
      void queryClient.invalidateQueries({
        queryKey: recipeKeys.detail(workspaceId, recipeId),
      })
    },
  })
}

export const useReplaceRecipeDietaryTags = ({
  supabase,
  workspaceId,
  recipeId,
}: {
  supabase: SupabaseClient
  workspaceId: string
  recipeId: string
}): UseMutationResult<void, Error, { tags: string[] }> => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ tags }) =>
      replaceRecipeDietaryTags({ supabase, recipeId, tags }),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: recipeKeys.list(workspaceId),
      })
      void queryClient.invalidateQueries({
        queryKey: recipeKeys.detail(workspaceId, recipeId),
      })
    },
  })
}

// (v2.1 Phase 8) Replace the full meal-type set for a recipe.
export const useReplaceRecipeMealTypes = ({
  supabase,
  workspaceId,
  recipeId,
}: {
  supabase: SupabaseClient
  workspaceId: string
  recipeId: string
}): UseMutationResult<void, Error, { mealTypes: MealType[] }> => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ mealTypes }) =>
      replaceRecipeMealTypes({ supabase, recipeId, mealTypes }),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: recipeKeys.list(workspaceId),
      })
      void queryClient.invalidateQueries({
        queryKey: recipeKeys.detail(workspaceId, recipeId),
      })
    },
  })
}
