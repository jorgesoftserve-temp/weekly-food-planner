import { useQuery, type UseQueryResult } from '@tanstack/react-query'
import type { SupabaseClient } from '@supabase/supabase-js'
import {
  getActiveGroceryLists,
  getGroceryListsForMenuId,
  groceryKeys,
  type ActiveGroceryResult,
  type GroceryListRecord,
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

export const useGroceryListsForMenuId = ({
  supabase,
  workspaceId,
  menuId,
  enabled = true,
}: {
  supabase: SupabaseClient
  workspaceId: string | null
  menuId: string | null
  enabled?: boolean
}): UseQueryResult<GroceryListRecord[]> =>
  useQuery({
    queryKey: groceryKeys.byMenuId(workspaceId ?? '', menuId ?? ''),
    queryFn: () =>
      getGroceryListsForMenuId({
        supabase,
        menuId: menuId!,
      }),
    enabled: enabled && !!workspaceId && !!menuId,
  })
