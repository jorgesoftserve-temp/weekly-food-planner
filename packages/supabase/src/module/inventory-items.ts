import type { SupabaseClient } from '@supabase/supabase-js'
import type { InventorySource, Unit, UpdateInventoryItemPatch } from '../types/db.js'
import { isMenuStillUpcoming } from './date-utils.js'

// (v2.0 Phase 1) Inventory — the workspace pantry. Rows are user stock, so the
// lifecycle flag is `is_consumed` (eaten / spoiled), NOT soft-delete; DELETE is
// a hard delete of the caller's own row. See PRODUCT_PRD §12, DATABASE_PRD §6.18.

export type InventoryItemRecord = {
  id: string
  workspace_id: string
  ingredient_id: string
  source: InventorySource
  quantity: number
  unit: Unit
  expiration_date: string | null
  source_menu_id: string | null
  source_slot_id: string | null
  label: string | null
  is_consumed: boolean
  created_by: string | null
  created_at: string
  updated_at: string
  // Joins used by the list UI + the Menu→Pantry tag derivation.
  ingredient: {
    id: string
    name: string
    image_url: string | null
    food_group: string | null
  } | null
  source_menu: {
    id: string
    week_start_date: string
    duration_days: number
  } | null
}

export type CreateInventoryItemInput = {
  ingredient_id: string
  source?: InventorySource
  quantity: number
  unit: Unit
  expiration_date?: string | null
  source_menu_id?: string | null
  source_slot_id?: string | null
  label?: string | null
  /** workspace_members.id of the creator — the route resolves this before insert. */
  created_by?: string | null
}

export const inventoryQueryKeys = {
  list: (workspaceId: string) => ['inventory', 'list', workspaceId] as const,
}

export const inventoryKeys = {
  list: (workspaceId: string) => ['inventory', 'list', workspaceId] as const,
}

const INVENTORY_SELECT = `id, workspace_id, ingredient_id, source, quantity, unit, expiration_date,
  source_menu_id, source_slot_id, label, is_consumed, created_by, created_at, updated_at,
  ingredient:ingredients (id, name, image_url, food_group),
  source_menu:menus (id, week_start_date, duration_days)`

// PostgREST returns `numeric` columns as strings; coerce quantity to a number so
// callers never have to. Everything else maps straight through.
const toRecord = (row: Record<string, unknown>): InventoryItemRecord => ({
  ...(row as unknown as InventoryItemRecord),
  quantity: Number(row.quantity),
})

export const listInventoryItems = async ({
  supabase,
  workspaceId,
  includeConsumed = false,
}: {
  supabase: SupabaseClient
  workspaceId: string
  includeConsumed?: boolean
}): Promise<InventoryItemRecord[]> => {
  let query = supabase
    .from('inventory_items')
    .select(INVENTORY_SELECT)
    .eq('workspace_id', workspaceId)
  if (!includeConsumed) query = query.eq('is_consumed', false)
  const { data, error } = await query.order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  return (data ?? []).map((row) => toRecord(row as Record<string, unknown>))
}

// (v2.0 Phase 5) Lazy per-row expiry sweep — there is no cron in v2, so leftover
// stock expires on read. Marks every non-consumed `leftover` / `cook_remainder`
// row whose own `expiration_date` is strictly before today as consumed. Ordinary
// pantry stock (`manual` / `purchase`) is user-managed and is NOT auto-expired.
// Best-effort: pass a privileged client so the sweep runs regardless of the
// reader's role. Returns the number of rows expired.
export const expireLeftovers = async ({
  supabase,
  workspaceId,
  todayYmd,
}: {
  supabase: SupabaseClient
  workspaceId: string
  todayYmd: string
}): Promise<{ expiredCount: number }> => {
  const { data, error } = await supabase
    .from('inventory_items')
    .update({ is_consumed: true })
    .eq('workspace_id', workspaceId)
    .eq('is_consumed', false)
    .in('source', ['leftover', 'cook_remainder'])
    .not('expiration_date', 'is', null)
    .lt('expiration_date', todayYmd)
    .select('id')
  if (error) throw new Error(error.message)
  return { expiredCount: (data ?? []).length }
}

export const createInventoryItem = async ({
  supabase,
  workspaceId,
  payload,
}: {
  supabase: SupabaseClient
  workspaceId: string
  payload: CreateInventoryItemInput
}): Promise<{ id: string }> => {
  if (payload.quantity < 0) throw new Error('quantity must be >= 0')
  const { data: row, error } = await supabase
    .from('inventory_items')
    .insert({
      workspace_id: workspaceId,
      ingredient_id: payload.ingredient_id,
      source: payload.source ?? 'manual',
      quantity: payload.quantity,
      unit: payload.unit,
      expiration_date: payload.expiration_date ?? null,
      source_menu_id: payload.source_menu_id ?? null,
      source_slot_id: payload.source_slot_id ?? null,
      label: payload.label ?? null,
      created_by: payload.created_by ?? null,
    })
    .select('id')
    .single()
  if (error || !row) {
    throw new Error(error?.message ?? 'failed to create inventory item')
  }
  return { id: (row as { id: string }).id }
}

export const updateInventoryItem = async ({
  supabase,
  workspaceId,
  itemId,
  patch,
}: {
  supabase: SupabaseClient
  workspaceId: string
  itemId: string
  patch: UpdateInventoryItemPatch
}): Promise<void> => {
  if (Object.keys(patch).length === 0) throw new Error('no fields to update')
  if (patch.quantity !== undefined && patch.quantity < 0) {
    throw new Error('quantity must be >= 0')
  }
  const { error } = await supabase
    .from('inventory_items')
    .update(patch)
    .eq('id', itemId)
    .eq('workspace_id', workspaceId)
  if (error) throw new Error(error.message)
}

// Hard delete — inventory rows are the caller's own stock, not shared content,
// so they don't carry `is_deleted`. To retire an item without removing it, set
// `is_consumed = true` via updateInventoryItem instead.
export const deleteInventoryItem = async ({
  supabase,
  workspaceId,
  itemId,
}: {
  supabase: SupabaseClient
  workspaceId: string
  itemId: string
}): Promise<void> => {
  const { error } = await supabase
    .from('inventory_items')
    .delete()
    .eq('id', itemId)
    .eq('workspace_id', workspaceId)
  if (error) throw new Error(error.message)
}

// ---------------------------------------------------------------------------
// Source display tags (read-side derivation; the `source` enum is unchanged).
// PRODUCT_PRD §15.4 / ARCHITECTURE_PRD §17.7 — Menu→Pantry is lazy, no cron.
// ---------------------------------------------------------------------------

export type InventoryDisplayTag = 'pantry' | 'menu' | 'leftover'

// `manual` → Pantry, `leftover` → Leftover, `cook_remainder` → Pantry (raw stock
// you still have after cooking), `purchase` → Menu *while its linked menu's week
// is still current*, then Pantry once that week has ended (the item graduates to
// general stock). A purchase with no linked menu reads as Pantry.
export const deriveInventoryDisplayTag = ({
  source,
  sourceMenu,
  todayYmd,
}: {
  source: InventorySource
  sourceMenu: { week_start_date: string; duration_days: number } | null
  todayYmd: string
}): InventoryDisplayTag => {
  if (source === 'leftover') return 'leftover'
  if (source === 'purchase' && sourceMenu) {
    return isMenuStillUpcoming({
      weekStartDate: sourceMenu.week_start_date,
      durationDays: sourceMenu.duration_days,
      todayYmd,
    })
      ? 'menu'
      : 'pantry'
  }
  return 'pantry'
}
