import { useQuery, type UseQueryResult } from '@tanstack/react-query'
import type { SupabaseClient } from '@supabase/supabase-js'
import {
  getActiveMenu,
  menuKeys,
  type MenuRecord,
} from './menus.js'

export const useActiveMenu = ({
  supabase,
  workspaceId,
  weekStartDate,
  enabled = true,
}: {
  supabase: SupabaseClient
  workspaceId: string | null
  weekStartDate?: string
  enabled?: boolean
}): UseQueryResult<MenuRecord | null> => {
  const queryKey = weekStartDate
    ? menuKeys.activeForWeek(workspaceId ?? '', weekStartDate)
    : menuKeys.active(workspaceId ?? '')
  return useQuery({
    queryKey,
    queryFn: () =>
      getActiveMenu({
        supabase,
        workspaceId: workspaceId!,
        weekStartDate,
      }),
    enabled: enabled && !!workspaceId,
  })
}
