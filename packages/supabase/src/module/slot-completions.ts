import type { SupabaseClient } from '@supabase/supabase-js'
import type {
  CreateSlotCompletionPayload,
  SlotCompletionRow,
  UpdateSlotCompletionPatch,
} from '../types/db.js'

// (v2.0 Phase 4) Cook-status execution record per accepted-menu slot. One row per
// slot (UNIQUE(menu_slot_id)); an absent row is read as 'planned'. Separate from
// menu_slots so cook-status never reaches accepted_seed or the engine.
// PRODUCT_PRD §14, DATABASE_PRD §6.21.

export type SlotCompletionRecord = SlotCompletionRow

export const slotCompletionQueryKeys = {
  forMenu: (menuId: string) => ['slot-completions', 'menu', menuId] as const,
}

export const slotCompletionKeys = {
  forMenu: (menuId: string) => ['slot-completions', 'menu', menuId] as const,
}

const COMPLETION_COLUMNS =
  'id, menu_slot_id, workspace_id, status, cooked_at, notes, created_by, created_at, updated_at'

// All completions for a menu's slots, joined through menu_slots so we can filter
// by menu_id (slot_completions has no menu_id of its own). The inner join is
// dropped from the returned shape — callers key by menu_slot_id.
export const getSlotCompletionsForMenu = async ({
  supabase,
  menuId,
}: {
  supabase: SupabaseClient
  menuId: string
}): Promise<SlotCompletionRecord[]> => {
  const { data, error } = await supabase
    .from('slot_completions')
    .select(`${COMPLETION_COLUMNS}, menu_slot:menu_slots!inner (menu_id)`)
    .eq('menu_slot.menu_id', menuId)
  if (error) throw new Error(error.message)
  return ((data ?? []) as Array<Record<string, unknown>>).map((row) => {
    // Strip the join helper; keep only the flat completion row.
    const { menu_slot: _menuSlot, ...rest } = row
    return rest as unknown as SlotCompletionRecord
  })
}

// Upsert keyed by menu_slot_id — flips a slot's cook-status, creating the row on
// first write. Returns the resulting row. The route layer resolves workspace_id
// + created_by and keeps menu_slots.cooked_at in sync.
export const upsertSlotCompletion = async ({
  supabase,
  payload,
}: {
  supabase: SupabaseClient
  payload: CreateSlotCompletionPayload
}): Promise<SlotCompletionRecord> => {
  const { data, error } = await supabase
    .from('slot_completions')
    .upsert(
      {
        menu_slot_id: payload.menu_slot_id,
        workspace_id: payload.workspace_id,
        status: payload.status ?? 'planned',
        cooked_at: payload.cooked_at ?? null,
        notes: payload.notes ?? null,
        created_by: payload.created_by ?? null,
      },
      { onConflict: 'menu_slot_id' },
    )
    .select(COMPLETION_COLUMNS)
    .single()
  if (error || !data) {
    throw new Error(error?.message ?? 'failed to upsert slot completion')
  }
  return data as unknown as SlotCompletionRecord
}

// Patch an existing completion by menu_slot_id (no insert). Used when only
// mutating notes without changing status.
export const updateSlotCompletion = async ({
  supabase,
  menuSlotId,
  patch,
}: {
  supabase: SupabaseClient
  menuSlotId: string
  patch: UpdateSlotCompletionPatch
}): Promise<void> => {
  if (Object.keys(patch).length === 0) throw new Error('no fields to update')
  const { error } = await supabase
    .from('slot_completions')
    .update(patch)
    .eq('menu_slot_id', menuSlotId)
  if (error) throw new Error(error.message)
}
