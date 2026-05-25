import { useQuery, type UseQueryResult } from '@tanstack/react-query'
import type { SupabaseClient } from '@supabase/supabase-js'
import {
  getActiveGroceryLists,
  groceryKeys,
  type ActiveGroceryResult,
} from './grocery.js'

export const useActiveGroceryLists = ({
  supabase,
  workspaceId,
  weekStartDate,
  enabled = true,
}: {
  supabase: SupabaseClient
  workspaceId: string | null
  weekStartDate?: string
  enabled?: boolean
}): UseQueryResult<ActiveGroceryResult | null> => {
  const queryKey = weekStartDate
    ? groceryKeys.activeForWeek(workspaceId ?? '', weekStartDate)
    : groceryKeys.active(workspaceId ?? '')
  return useQuery({
    queryKey,
    queryFn: () =>
      getActiveGroceryLists({
        supabase,
        workspaceId: workspaceId!,
        weekStartDate,
      }),
    enabled: enabled && !!workspaceId,
  })
}
