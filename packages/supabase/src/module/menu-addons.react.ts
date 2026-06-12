import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
  type UseQueryResult,
} from '@tanstack/react-query'
import type { SupabaseClient } from '@supabase/supabase-js'
import {
  attachMenuAddon,
  detachMenuAddon,
  getMenuAddons,
  menuAddonKeys,
  updateMenuAddon,
  type MenuAddonRecord,
} from './menu-addons.js'
import type { CreateMenuAddonPayload, UpdateMenuAddonPatch } from '../types/db.js'

// (v2.1 Track D) Hooks for menu_addons. The upsert/delete route handler
// validates addon kind and re-runs grocery recompute after each mutation.

export const useMenuAddons = ({
  supabase,
  menuId,
  enabled = true,
}: {
  supabase: SupabaseClient
  menuId: string | null
  enabled?: boolean
}): UseQueryResult<MenuAddonRecord[]> =>
  useQuery({
    queryKey: menuAddonKeys.forMenu(menuId ?? ''),
    queryFn: () => getMenuAddons({ supabase, menuId: menuId! }),
    enabled: enabled && !!menuId,
  })

export const useAttachMenuAddon = ({
  supabase,
  menuId,
}: {
  supabase: SupabaseClient
  menuId: string
}): UseMutationResult<MenuAddonRecord, Error, CreateMenuAddonPayload> => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (payload: CreateMenuAddonPayload) =>
      attachMenuAddon({ supabase, payload }),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: menuAddonKeys.forMenu(menuId),
      })
    },
  })
}

export const useUpdateMenuAddon = ({
  supabase,
  menuId,
}: {
  supabase: SupabaseClient
  menuId: string
}): UseMutationResult<void, Error, { addonId: string; patch: UpdateMenuAddonPatch }> => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ addonId, patch }: { addonId: string; patch: UpdateMenuAddonPatch }) =>
      updateMenuAddon({ supabase, addonId, patch }),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: menuAddonKeys.forMenu(menuId),
      })
    },
  })
}

export const useDetachMenuAddon = ({
  supabase,
  menuId,
}: {
  supabase: SupabaseClient
  menuId: string
}): UseMutationResult<void, Error, { addonId: string }> => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ addonId }: { addonId: string }) =>
      detachMenuAddon({ supabase, addonId }),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: menuAddonKeys.forMenu(menuId),
      })
    },
  })
}
