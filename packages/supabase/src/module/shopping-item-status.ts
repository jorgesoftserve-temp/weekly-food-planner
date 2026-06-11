import type { SupabaseClient } from '@supabase/supabase-js'
import type { UpdateShoppingItemStatusPatch } from '../types/db.js'

// (v2.0 Phase 2) Per-grocery-line acquisition state inside a shopping session.
// Rows are seeded (pending, 0) when the session opens; the confirmation UI
// flips status + acquired_quantity per line. PRODUCT_PRD §13.

// Updates the seeded status row for one grocery line within a session. Keyed by
// (session_id, grocery_item_id) — the table's unique constraint. The session is
// the workspace anchor; RLS on shopping_item_status gates through it.
export const updateShoppingItemStatus = async ({
  supabase,
  sessionId,
  groceryItemId,
  patch,
}: {
  supabase: SupabaseClient
  sessionId: string
  groceryItemId: string
  patch: UpdateShoppingItemStatusPatch
}): Promise<void> => {
  if (Object.keys(patch).length === 0) throw new Error('no fields to update')
  if (patch.acquired_quantity !== undefined && patch.acquired_quantity < 0) {
    throw new Error('acquired_quantity must be >= 0')
  }
  const { error } = await supabase
    .from('shopping_item_status')
    .update(patch)
    .eq('session_id', sessionId)
    .eq('grocery_item_id', groceryItemId)
  if (error) throw new Error(error.message)
}
