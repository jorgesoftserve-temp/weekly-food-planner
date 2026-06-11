import type { SupabaseClient } from '@supabase/supabase-js'
import type {
  AcquiredStatus,
  ShoppingStatus,
  Unit,
  UpdateShoppingSessionPatch,
} from '../types/db.js'

// (v2.0 Phase 2) Shopping confirmation — one shopping pass over an accepted
// menu's grocery list. The session holds per-line acquisition state
// (shopping_item_status) and a quantity-weighted completeness computed at
// finalize. PRODUCT_PRD §13, DATABASE_PRD §6.19/§6.20.

export type ShoppingItemStatusRecord = {
  id: string
  session_id: string
  grocery_item_id: string
  acquired_quantity: number
  status: AcquiredStatus
  // Joined so the confirmation UI can render the line + group by food group.
  grocery_item: {
    id: string
    ingredient_id: string
    quantity: number
    unit: Unit
    ingredient: { name: string; food_group: string | null } | null
  } | null
}

export type ShoppingSessionRecord = {
  id: string
  menu_id: string
  workspace_id: string
  status: ShoppingStatus
  completeness: number | null
  created_by: string | null
  created_at: string
  updated_at: string
  items: ShoppingItemStatusRecord[]
}

export const shoppingSessionQueryKeys = {
  active: (menuId: string) => ['shopping-session', 'active', menuId] as const,
}

export const shoppingSessionKeys = {
  active: (menuId: string) => ['shopping-session', 'active', menuId] as const,
}

const SESSION_SELECT = `id, menu_id, workspace_id, status, completeness, created_by, created_at, updated_at,
  items:shopping_item_status (
    id, session_id, grocery_item_id, acquired_quantity, status,
    grocery_item:grocery_items (
      id, ingredient_id, quantity, unit,
      ingredient:ingredients (name, food_group)
    )
  )`

// PostgREST returns numeric columns as strings; coerce acquired_quantity and the
// joined grocery_item.quantity to numbers so callers never re-parse.
const toSessionRecord = (row: Record<string, unknown>): ShoppingSessionRecord => {
  const items = ((row.items as Array<Record<string, unknown>> | null) ?? []).map(
    (item) => {
      const gi = item.grocery_item as Record<string, unknown> | null
      return {
        ...(item as unknown as ShoppingItemStatusRecord),
        acquired_quantity: Number(item.acquired_quantity),
        grocery_item: gi
          ? { ...(gi as unknown as ShoppingItemStatusRecord['grocery_item']), quantity: Number(gi.quantity) }
          : null,
      } as ShoppingItemStatusRecord
    },
  )
  return { ...(row as unknown as ShoppingSessionRecord), items }
}

// The in-progress session for a menu (at most one — partial unique index), with
// its seeded item statuses. Returns null when no session is open.
export const getActiveShoppingSession = async ({
  supabase,
  menuId,
}: {
  supabase: SupabaseClient
  menuId: string
}): Promise<ShoppingSessionRecord | null> => {
  const { data, error } = await supabase
    .from('shopping_sessions')
    .select(SESSION_SELECT)
    .eq('menu_id', menuId)
    .eq('status', 'in_progress')
    .maybeSingle()
  if (error) throw new Error(error.message)
  if (!data) return null
  return toSessionRecord(data as Record<string, unknown>)
}

export const getShoppingSessionById = async ({
  supabase,
  sessionId,
}: {
  supabase: SupabaseClient
  sessionId: string
}): Promise<ShoppingSessionRecord | null> => {
  const { data, error } = await supabase
    .from('shopping_sessions')
    .select(SESSION_SELECT)
    .eq('id', sessionId)
    .maybeSingle()
  if (error) throw new Error(error.message)
  if (!data) return null
  return toSessionRecord(data as Record<string, unknown>)
}

// Opens a session and seeds one pending shopping_item_status row per grocery
// item so the confirmation UI has a row to flip. The partial unique index
// `(menu_id) WHERE status='in_progress'` guards against a duplicate open
// session — the insert will fail if one already exists.
export const openShoppingSession = async ({
  supabase,
  workspaceId,
  menuId,
  groceryItemIds,
  createdBy,
}: {
  supabase: SupabaseClient
  workspaceId: string
  menuId: string
  groceryItemIds: string[]
  createdBy?: string | null
}): Promise<{ id: string }> => {
  const { data: row, error } = await supabase
    .from('shopping_sessions')
    .insert({
      menu_id: menuId,
      workspace_id: workspaceId,
      status: 'in_progress',
      created_by: createdBy ?? null,
    })
    .select('id')
    .single()
  if (error || !row) {
    throw new Error(error?.message ?? 'failed to open shopping session')
  }
  const sessionId = (row as { id: string }).id

  if (groceryItemIds.length > 0) {
    const { error: seedErr } = await supabase.from('shopping_item_status').insert(
      groceryItemIds.map((grocery_item_id) => ({
        session_id: sessionId,
        grocery_item_id,
        acquired_quantity: 0,
        status: 'pending' as AcquiredStatus,
      })),
    )
    if (seedErr) throw new Error(seedErr.message)
  }
  return { id: sessionId }
}

export const updateShoppingSession = async ({
  supabase,
  sessionId,
  patch,
}: {
  supabase: SupabaseClient
  sessionId: string
  patch: UpdateShoppingSessionPatch
}): Promise<void> => {
  if (Object.keys(patch).length === 0) throw new Error('no fields to update')
  const { error } = await supabase
    .from('shopping_sessions')
    .update(patch)
    .eq('id', sessionId)
  if (error) throw new Error(error.message)
}
