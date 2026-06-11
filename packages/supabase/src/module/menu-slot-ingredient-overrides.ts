import type { SupabaseClient } from '@supabase/supabase-js'
import type {
  CreateMenuSlotIngredientOverridePayload,
  MenuSlotIngredientOverrideRow,
} from '../types/db.js'

// (v2.0 Phase 6) Menu-level ingredient substitution. One row per
// (menu_slot_id, original_ingredient_id) (UNIQUE). Keyed by menu_slot_id so it
// never reaches accepted_seed or the engine — consumed ONLY by grocery
// recompute (recomputeGroceryListsForMenu). PRODUCT_PRD §20, DATABASE_PRD §6.22.

export type MenuSlotIngredientOverrideRecord = MenuSlotIngredientOverrideRow

export const menuSlotOverrideQueryKeys = {
  forMenu: (menuId: string) => ['menu-slot-overrides', 'menu', menuId] as const,
}

export const menuSlotOverrideKeys = {
  forMenu: (menuId: string) => ['menu-slot-overrides', 'menu', menuId] as const,
}

const OVERRIDE_COLUMNS =
  'id, menu_slot_id, workspace_id, original_ingredient_id, substitute_ingredient_id, quantity, unit, note, created_by, created_at, updated_at'

// PostgREST returns numeric `quantity` as a string; coerce to number (or null).
const toRecord = (row: Record<string, unknown>): MenuSlotIngredientOverrideRecord => ({
  ...(row as unknown as MenuSlotIngredientOverrideRecord),
  quantity: row.quantity == null ? null : Number(row.quantity),
})

// All overrides for a menu's slots, joined through menu_slots so we can filter
// by menu_id (the table has no menu_id of its own). The join helper is stripped
// from the returned shape — callers key by menu_slot_id.
export const getOverridesForMenu = async ({
  supabase,
  menuId,
}: {
  supabase: SupabaseClient
  menuId: string
}): Promise<MenuSlotIngredientOverrideRecord[]> => {
  const { data, error } = await supabase
    .from('menu_slot_ingredient_overrides')
    .select(`${OVERRIDE_COLUMNS}, menu_slot:menu_slots!inner (menu_id)`)
    .eq('menu_slot.menu_id', menuId)
  if (error) throw new Error(error.message)
  return ((data ?? []) as Array<Record<string, unknown>>).map((row) => {
    const { menu_slot: _menuSlot, ...rest } = row
    return toRecord(rest)
  })
}

// Upsert keyed by (menu_slot_id, original_ingredient_id) — sets or replaces the
// substitute for one ingredient on one slot. The route layer resolves
// workspace_id + created_by, validates the substitute, and re-runs recompute.
export const upsertMenuSlotIngredientOverride = async ({
  supabase,
  payload,
}: {
  supabase: SupabaseClient
  payload: CreateMenuSlotIngredientOverridePayload
}): Promise<MenuSlotIngredientOverrideRecord> => {
  const { data, error } = await supabase
    .from('menu_slot_ingredient_overrides')
    .upsert(
      {
        menu_slot_id: payload.menu_slot_id,
        workspace_id: payload.workspace_id,
        original_ingredient_id: payload.original_ingredient_id,
        substitute_ingredient_id: payload.substitute_ingredient_id,
        quantity: payload.quantity ?? null,
        unit: payload.unit ?? null,
        note: payload.note ?? null,
        created_by: payload.created_by ?? null,
      },
      { onConflict: 'menu_slot_id,original_ingredient_id' },
    )
    .select(OVERRIDE_COLUMNS)
    .single()
  if (error || !data) {
    throw new Error(error?.message ?? 'failed to upsert ingredient override')
  }
  return toRecord(data as Record<string, unknown>)
}

// Remove a substitution, restoring the recipe's original ingredient for that
// slot on the next recompute.
export const deleteMenuSlotIngredientOverride = async ({
  supabase,
  menuSlotId,
  originalIngredientId,
}: {
  supabase: SupabaseClient
  menuSlotId: string
  originalIngredientId: string
}): Promise<void> => {
  const { error } = await supabase
    .from('menu_slot_ingredient_overrides')
    .delete()
    .eq('menu_slot_id', menuSlotId)
    .eq('original_ingredient_id', originalIngredientId)
  if (error) throw new Error(error.message)
}
