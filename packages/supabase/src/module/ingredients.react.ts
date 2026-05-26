import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
  type UseQueryResult,
} from '@tanstack/react-query'
import type { SupabaseClient } from '@supabase/supabase-js'
import {
  ingredientKeys,
  listIngredients,
  type CreateIngredientPayload,
  type IngredientRecord,
} from './ingredients.js'

export const useIngredients = ({
  supabase,
  enabled = true,
}: {
  supabase: SupabaseClient
  enabled?: boolean
}): UseQueryResult<IngredientRecord[]> =>
  useQuery({
    queryKey: ingredientKeys.list(),
    queryFn: () => listIngredients({ supabase }),
    enabled,
  })

// Posts a new ingredient through the API route (which uses the admin client
// to bypass the service-role-only INSERT policy). Invalidates the list cache
// on success so any picker re-fetches and shows the new row.
export const useCreateIngredient = (): UseMutationResult<
  IngredientRecord,
  Error,
  CreateIngredientPayload
> => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (payload: CreateIngredientPayload) => {
      const res = await fetch('/api/ingredients', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const body = (await res.json()) as
        | { ingredient: IngredientRecord }
        | { error?: string; message?: string }
      if (!res.ok) {
        const msg =
          ('error' in body && body.error) ||
          ('message' in body && body.message) ||
          'Failed to create ingredient'
        throw new Error(msg)
      }
      return (body as { ingredient: IngredientRecord }).ingredient
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ingredientKeys.list() })
    },
  })
}
