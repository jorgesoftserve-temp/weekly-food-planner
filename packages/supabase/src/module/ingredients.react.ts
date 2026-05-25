import { useQuery, type UseQueryResult } from '@tanstack/react-query'
import type { SupabaseClient } from '@supabase/supabase-js'
import {
  ingredientKeys,
  listIngredients,
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
