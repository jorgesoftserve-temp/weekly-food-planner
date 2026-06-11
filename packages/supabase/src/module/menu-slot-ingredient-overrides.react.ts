import { useQuery, type UseQueryResult } from '@tanstack/react-query'
import type { SupabaseClient } from '@supabase/supabase-js'
import {
  getOverridesForMenu,
  menuSlotOverrideKeys,
  type MenuSlotIngredientOverrideRecord,
} from './menu-slot-ingredient-overrides.js'

// (v2.0 Phase 6) Read every ingredient override for an accepted menu's slots.
// The upsert/delete mutations go through the ingredient-overrides route handler
// (it validates the substitute against the slot eaters' allergies/exclusions and
// re-runs grocery recompute), so no mutation hook lives here — only the read.
export const useMenuSlotIngredientOverrides = ({
  supabase,
  menuId,
  enabled = true,
}: {
  supabase: SupabaseClient
  menuId: string | null
  enabled?: boolean
}): UseQueryResult<MenuSlotIngredientOverrideRecord[]> =>
  useQuery({
    queryKey: menuSlotOverrideKeys.forMenu(menuId ?? ''),
    queryFn: () => getOverridesForMenu({ supabase, menuId: menuId! }),
    enabled: enabled && !!menuId,
  })
