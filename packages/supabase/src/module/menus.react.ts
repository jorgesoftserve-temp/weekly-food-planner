import { useQuery, type UseQueryResult } from '@tanstack/react-query'
import type { SupabaseClient } from '@supabase/supabase-js'
import {
  getActiveMenu,
  getDraftMenu,
  listAcceptedMenus,
  menuKeys,
  type MenuHistoryEntry,
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

export const useDraftMenu = ({
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
    ? menuKeys.draftForWeek(workspaceId ?? '', weekStartDate)
    : menuKeys.draft(workspaceId ?? '')
  return useQuery({
    queryKey,
    queryFn: () =>
      getDraftMenu({
        supabase,
        workspaceId: workspaceId!,
        weekStartDate,
      }),
    enabled: enabled && !!workspaceId,
  })
}

export const useMenuHistory = ({
  supabase,
  workspaceId,
  enabled = true,
}: {
  supabase: SupabaseClient
  workspaceId: string | null
  enabled?: boolean
}): UseQueryResult<MenuHistoryEntry[]> =>
  useQuery({
    queryKey: menuKeys.history(workspaceId ?? ''),
    queryFn: () =>
      listAcceptedMenus({ supabase, workspaceId: workspaceId! }),
    enabled: enabled && !!workspaceId,
  })
