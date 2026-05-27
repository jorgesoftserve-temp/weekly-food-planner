import { useQuery, type UseQueryResult } from '@tanstack/react-query'
import type { SupabaseClient } from '@supabase/supabase-js'
import {
  getActiveMenu,
  getDraftMenu,
  getMenuById,
  listAcceptedMenus,
  listUpcomingAcceptedMenus,
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

export const useMenuById = ({
  supabase,
  workspaceId,
  menuId,
  enabled = true,
}: {
  supabase: SupabaseClient
  workspaceId: string | null
  menuId: string | null
  enabled?: boolean
}): UseQueryResult<MenuRecord | null> =>
  useQuery({
    queryKey: menuKeys.byId(workspaceId ?? '', menuId ?? ''),
    queryFn: () =>
      getMenuById({
        supabase,
        workspaceId: workspaceId!,
        menuId: menuId!,
      }),
    enabled: enabled && !!workspaceId && !!menuId,
  })

export const useUpcomingMenus = ({
  supabase,
  workspaceId,
  enabled = true,
}: {
  supabase: SupabaseClient
  workspaceId: string | null
  enabled?: boolean
}): UseQueryResult<MenuRecord[]> =>
  useQuery({
    queryKey: menuKeys.upcoming(workspaceId ?? ''),
    queryFn: () =>
      listUpcomingAcceptedMenus({ supabase, workspaceId: workspaceId! }),
    enabled: enabled && !!workspaceId,
  })
