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
