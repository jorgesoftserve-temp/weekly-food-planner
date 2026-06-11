import { useQuery, type UseQueryResult } from '@tanstack/react-query'
import type { SupabaseClient } from '@supabase/supabase-js'
import {
  getSlotCompletionsForMenu,
  slotCompletionKeys,
  type SlotCompletionRecord,
} from './slot-completions.js'

// (v2.0 Phase 4) Read every cook-status completion for an accepted menu's slots.
// The status-flip mutation goes through the completion route handler (it syncs
// menu_slots.cooked_at and validates the accepted menu), so no mutation hook
// lives here — only the read.
export const useMenuSlotCompletions = ({
  supabase,
  menuId,
  enabled = true,
}: {
  supabase: SupabaseClient
  menuId: string | null
  enabled?: boolean
}): UseQueryResult<SlotCompletionRecord[]> =>
  useQuery({
    queryKey: slotCompletionKeys.forMenu(menuId ?? ''),
    queryFn: () => getSlotCompletionsForMenu({ supabase, menuId: menuId! }),
    enabled: enabled && !!menuId,
  })
