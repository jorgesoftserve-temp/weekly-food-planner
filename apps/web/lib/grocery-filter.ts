import type { GroceryListRecord } from '@weekly-food-planner/supabase'

export type ScaledGroceryItem = {
  id: string
  ingredient_id: string
  quantity: number
  unit: string
  scheduled_purchase_day: string | null
}

export type FilteredGroceryList = {
  id: string
  target_member_id: string | null
  scaledItems: ScaledGroceryItem[]
}

const toNumber = (q: string | number): number =>
  typeof q === 'string' ? Number.parseFloat(q) : q

// Mon-first day ordering so we can fold scheduled_purchase_day to the earliest
// across merged rows. Unknown/NULL sorts last.
const DAY_RANK: Record<string, number> = {
  monday: 0,
  tuesday: 1,
  wednesday: 2,
  thursday: 3,
  friday: 4,
  saturday: 5,
  sunday: 6,
}

const earliestDay = (
  a: string | null,
  b: string | null,
): string | null => {
  if (a === null) return b
  if (b === null) return a
  return (DAY_RANK[a] ?? 99) <= (DAY_RANK[b] ?? 99) ? a : b
}

// Apply the shop-for-subset filter to a set of grocery lists for the menu.
//
// Semantics (PRODUCT_PRD §7.1 — shop-for-subset):
//   - The accepted menu's `menu_participants` is the head-count denominator.
//     `selectedIds` is the subset the user wants to shop for right now.
//   - **Shared bucket** (target_member_id IS NULL): scale every quantity by
//     selectedCount / participantCount. Phase 4 will introduce servings-aware
//     baseline scaling; this filter composes on top of that without change.
//   - **Per-member bucket**: include only when target_member_id is in
//     selectedIds. Quantities untouched — a per-member slot already produces
//     for 1 eater.
//   - Empty `selectedIds` OR `selectedIds` equal to `participantIds` means
//     "no filter" — the original quantities and lists come back through
//     unchanged.
//
// `participantIds` and `selectedIds` are passed as string[] for callsite
// simplicity; the function dedupes internally.
export const applyShopForFilter = ({
  lists,
  participantIds,
  selectedIds,
}: {
  lists: GroceryListRecord[]
  participantIds: string[]
  selectedIds: string[] | null
}): FilteredGroceryList[] => {
  const participantSet = new Set(participantIds)
  const participantCount = participantSet.size
  const selectedSet = selectedIds ? new Set(selectedIds) : null
  // Treat "selected everyone" as no filter — the math collapses but we'd
  // rather not bother allocating new arrays.
  const isFiltered =
    selectedSet !== null &&
    selectedSet.size > 0 &&
    (selectedSet.size !== participantCount ||
      [...selectedSet].some((id) => !participantSet.has(id)))

  if (!isFiltered) {
    return lists.map((list) => ({
      id: list.id,
      target_member_id: list.target_member_id,
      scaledItems: list.grocery_items.map((item) => ({
        id: item.id,
        ingredient_id: item.ingredient_id,
        quantity: toNumber(item.quantity),
        unit: item.unit,
        scheduled_purchase_day: item.scheduled_purchase_day,
      })),
    }))
  }

  // Effective head-count ratio for shared scaling. Falls back to 1 if the
  // menu somehow has zero participants (legacy data quirk) so we never
  // divide by zero — the filtered list just shows raw quantities.
  const ratio =
    participantCount === 0 ? 1 : (selectedSet?.size ?? 0) / participantCount

  return lists
    .filter((list) => {
      if (list.target_member_id === null) return true
      return selectedSet?.has(list.target_member_id) ?? false
    })
    .map((list) => {
      const scale = list.target_member_id === null ? ratio : 1
      return {
        id: list.id,
        target_member_id: list.target_member_id,
        scaledItems: list.grocery_items.map((item) => ({
          id: item.id,
          ingredient_id: item.ingredient_id,
          quantity: toNumber(item.quantity) * scale,
          unit: item.unit,
          scheduled_purchase_day: item.scheduled_purchase_day,
        })),
      }
    })
}

// (v2.0 item 8) Consolidated "everyone / whole household" grocery list — a single
// list of the totals you'd actually buy.
//
// IMPORTANT no-double-count rule: recomputeGroceryListsForMenu adds EVERY slot to
// the shared bucket (target_member_id IS NULL), so the shared list is ALREADY the
// household total; the per-member lists are a breakdown of it. We therefore
// consolidate the shared list when present, and only union the per-member lists
// when there is no shared list (e.g. a custom menu with only per-member slots).
// Summing shared + per-member would double-count.
//
// Keyed by (ingredient_id, unit); quantities summed; scheduled_purchase_day folded
// to the earliest. Pure read-side — composes after applyShopForFilter and never
// mutates grocery_items.
export const aggregateHouseholdGrocery = ({
  lists,
}: {
  lists: GroceryListRecord[]
}): FilteredGroceryList => {
  const shared = lists.filter((l) => l.target_member_id === null)
  const source = shared.length > 0 ? shared : lists

  const byKey = new Map<string, ScaledGroceryItem>()
  for (const list of source) {
    for (const item of list.grocery_items) {
      const key = `${item.ingredient_id}::${item.unit}`
      const qty = toNumber(item.quantity)
      const existing = byKey.get(key)
      if (existing) {
        existing.quantity += qty
        existing.scheduled_purchase_day = earliestDay(
          existing.scheduled_purchase_day,
          item.scheduled_purchase_day,
        )
      } else {
        byKey.set(key, {
          id: item.id,
          ingredient_id: item.ingredient_id,
          quantity: qty,
          unit: item.unit,
          scheduled_purchase_day: item.scheduled_purchase_day,
        })
      }
    }
  }

  return {
    id: 'household',
    target_member_id: null,
    scaledItems: Array.from(byKey.values()),
  }
}

// (v2.0 §17) Pantry-aware annotation — NON-DESTRUCTIVE. Each grocery line keeps
// its full required quantity and is annotated with on-hand stock and a
// suggested-to-buy figure (= max(0, required − onHand)). Matched by
// (ingredient_id, unit) so mismatched units never offset each other; multiple
// inventory rows for the same (ingredient, unit) sum. grocery_items are never
// mutated. Mirrors the engine-free read-side intent of menu-grocery.ts.
export type InventoryOnHand = {
  ingredient_id: string
  unit: string
  quantity: number
}

export type AnnotatedGroceryItem = ScaledGroceryItem & {
  /** On-hand stock matching this line's (ingredient_id, unit). */
  onHand: number
  /** max(0, required − onHand). */
  suggestedToBuy: number
  /** True when on-hand fully covers the required quantity. */
  fullyCovered: boolean
}

export const annotateWithInventory = ({
  items,
  inventory,
}: {
  items: ScaledGroceryItem[]
  inventory: InventoryOnHand[]
}): AnnotatedGroceryItem[] => {
  const onHandByKey = new Map<string, number>()
  for (const inv of inventory) {
    const key = `${inv.ingredient_id}::${inv.unit}`
    onHandByKey.set(key, (onHandByKey.get(key) ?? 0) + toNumber(inv.quantity))
  }
  return items.map((item) => {
    const onHand = onHandByKey.get(`${item.ingredient_id}::${item.unit}`) ?? 0
    const suggestedToBuy = Math.max(0, item.quantity - onHand)
    return {
      ...item,
      onHand,
      suggestedToBuy,
      fullyCovered: onHand >= item.quantity && item.quantity > 0,
    }
  })
}
