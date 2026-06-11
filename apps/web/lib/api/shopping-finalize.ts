import type { SupabaseClient } from '@supabase/supabase-js'
import {
  createInventoryItem,
  updateShoppingSession,
  type ShoppingItemStatusRecord,
  type ShoppingSessionRecord,
} from '@weekly-food-planner/supabase'

// (v2.0 Phase 2) Shopping finalisation helpers.
// PRODUCT_PRD §13, ARCHITECTURE_PRD §17, DATABASE_PRD §6.19/§6.20.
//
// Two exports:
//   computeShoppingCompleteness — pure, zero I/O, easily unit-testable.
//   shoppingStatusForCompleteness — pure threshold classifier.
//   finalizeShoppingSession — orchestrates: compute → persist session → spill to inventory.

// ---------------------------------------------------------------------------
// Pure helpers
// ---------------------------------------------------------------------------

/**
 * Quantity-weighted completeness: 100 × (Σ acquired_quantity) / (Σ required quantity).
 *
 * - Clamped to [0, 100].
 * - Rounded to two decimal places.
 * - Items whose required grocery quantity is 0 contribute 0 to both numerator and
 *   denominator (safe division guard).
 * - Items where the joined grocery_item is missing are skipped (treat required = 0).
 *
 * Signature for unit tests:
 *   computeShoppingCompleteness({ items: ShoppingItemStatusRecord[] }): number
 */
export const computeShoppingCompleteness = ({
  items,
}: {
  items: Pick<
    ShoppingItemStatusRecord,
    'acquired_quantity' | 'grocery_item'
  >[]
}): number => {
  let totalRequired = 0
  let totalAcquired = 0

  for (const item of items) {
    const required = item.grocery_item ? Number(item.grocery_item.quantity) : 0
    if (required <= 0) continue
    totalRequired += required
    // acquired_quantity is capped to required so one over-buy line cannot push
    // the total over 100 before clamping.
    totalAcquired += Math.min(Number(item.acquired_quantity), required)
  }

  if (totalRequired === 0) return 0

  const raw = (totalAcquired / totalRequired) * 100
  const clamped = Math.min(100, Math.max(0, raw))
  return Math.round(clamped * 100) / 100
}

/**
 * Maps a completeness percentage to the session's final DB status.
 *
 * Threshold (PRODUCT_PRD §13):
 *   pct >= 90 → 'complete'
 *   pct <  90 → 'incomplete'
 *
 * Note: the <30 "barely-shopped" band is a UI display nuance only; the DB
 * enum has only two terminal values: 'complete' | 'incomplete'.
 */
export const shoppingStatusForCompleteness = (
  pct: number,
): 'complete' | 'incomplete' => (pct >= 90 ? 'complete' : 'incomplete')

// ---------------------------------------------------------------------------
// Orchestration
// ---------------------------------------------------------------------------

export type FinalizeShoppingSessionResult = {
  completeness: number
  status: 'complete' | 'incomplete'
  /** Number of inventory rows written (acquired + partial lines with acquired_quantity > 0). */
  spilledCount: number
}

/**
 * Finalises an in-progress shopping session:
 * 1. Computes quantity-weighted completeness from session.items.
 * 2. Persists { status, completeness } back onto the session row.
 * 3. Spills every acquired/partial line whose acquired_quantity > 0 into
 *    inventory_items(source='purchase') — one row per grocery line.
 *    Skipped/pending lines produce no inventory row.
 *
 * This is the single entry point for finalisation; all callers (the finalize
 * route handler, any future background job) must use this function.
 * It does NOT call recomputeGroceryListsForMenu and does NOT touch grocery_items.
 */
export const finalizeShoppingSession = async ({
  supabase,
  workspaceId,
  session,
  createdBy,
}: {
  supabase: SupabaseClient
  workspaceId: string
  session: ShoppingSessionRecord
  /** workspace_members.id of the user performing the finalisation. */
  createdBy: string | null
}): Promise<FinalizeShoppingSessionResult> => {
  const completeness = computeShoppingCompleteness({ items: session.items })
  const status = shoppingStatusForCompleteness(completeness)

  // Persist the terminal status + completeness on the session row.
  await updateShoppingSession({
    supabase,
    sessionId: session.id,
    patch: { status, completeness },
  })

  // Spill purchased stock into inventory. Only lines that are acquired or
  // partial and have acquired_quantity > 0 generate an inventory row.
  // admin client is NOT needed here: the caller is creator/admin and RLS on
  // inventory_items allows creator/admin writes via fn_user_workspace_role.
  let spilledCount = 0
  for (const item of session.items) {
    const shouldSpill =
      (item.status === 'acquired' || item.status === 'partial') &&
      item.acquired_quantity > 0 &&
      item.grocery_item !== null

    if (!shouldSpill || !item.grocery_item) continue

    await createInventoryItem({
      supabase,
      workspaceId,
      payload: {
        ingredient_id: item.grocery_item.ingredient_id,
        source: 'purchase',
        quantity: item.acquired_quantity,
        unit: item.grocery_item.unit,
        source_menu_id: session.menu_id,
        created_by: createdBy,
      },
    })
    spilledCount++
  }

  return { completeness, status, spilledCount }
}
