import { describe, expect, it } from 'vitest'
import type { GroceryListRecord } from '@weekly-food-planner/supabase'
import {
  aggregateHouseholdGrocery,
  annotateWithInventory,
  applyShopForFilter,
} from '../grocery-filter'

const list = ({
  id,
  targetMemberId,
  items,
}: {
  id: string
  targetMemberId: string | null
  items: Array<{ id: string; ingredientId: string; quantity: number | string; unit?: string; day?: string | null }>
}): GroceryListRecord => ({
  id,
  target_member_id: targetMemberId,
  grocery_items: items.map((i) => ({
    id: i.id,
    ingredient_id: i.ingredientId,
    quantity: i.quantity,
    unit: (i.unit ?? 'g') as GroceryListRecord['grocery_items'][number]['unit'],
    scheduled_purchase_day: i.day ?? null,
  })),
})

describe('applyShopForFilter', () => {
  const shared = list({
    id: 'shared',
    targetMemberId: null,
    items: [
      { id: 'i1', ingredientId: 'ing-a', quantity: 400 },
      { id: 'i2', ingredientId: 'ing-b', quantity: '8' },
    ],
  })
  const alice = list({
    id: 'alice',
    targetMemberId: 'm1',
    items: [{ id: 'i3', ingredientId: 'ing-c', quantity: 100 }],
  })
  const bob = list({
    id: 'bob',
    targetMemberId: 'm2',
    items: [{ id: 'i4', ingredientId: 'ing-d', quantity: 200 }],
  })

  it('returns lists unchanged when selectedIds is null', () => {
    const result = applyShopForFilter({
      lists: [shared, alice, bob],
      participantIds: ['m1', 'm2'],
      selectedIds: null,
    })
    expect(result).toHaveLength(3)
    const sharedResult = result.find((r) => r.id === 'shared')
    expect(sharedResult?.scaledItems[0]?.quantity).toBe(400)
    expect(sharedResult?.scaledItems[1]?.quantity).toBe(8)
  })

  it('returns lists unchanged when selection equals participant set', () => {
    const result = applyShopForFilter({
      lists: [shared, alice, bob],
      participantIds: ['m1', 'm2'],
      selectedIds: ['m1', 'm2'],
    })
    expect(result).toHaveLength(3)
    expect(result.find((r) => r.id === 'shared')?.scaledItems[0]?.quantity).toBe(400)
  })

  it('halves shared quantities when shopping for half the participants', () => {
    const result = applyShopForFilter({
      lists: [shared, alice, bob],
      participantIds: ['m1', 'm2'],
      selectedIds: ['m1'],
    })
    const sharedResult = result.find((r) => r.id === 'shared')
    expect(sharedResult?.scaledItems[0]?.quantity).toBe(200)
    expect(sharedResult?.scaledItems[1]?.quantity).toBe(4)
  })

  it('keeps only the per-member buckets for selected members', () => {
    const result = applyShopForFilter({
      lists: [shared, alice, bob],
      participantIds: ['m1', 'm2'],
      selectedIds: ['m1'],
    })
    const memberLists = result.filter((r) => r.target_member_id !== null)
    expect(memberLists).toHaveLength(1)
    expect(memberLists[0]?.target_member_id).toBe('m1')
  })

  it('leaves per-member bucket quantities untouched (eaters = 1 already)', () => {
    const result = applyShopForFilter({
      lists: [alice],
      participantIds: ['m1', 'm2'],
      selectedIds: ['m1'],
    })
    expect(result[0]?.scaledItems[0]?.quantity).toBe(100)
  })

  it('coerces string quantities to numbers in the unfiltered path', () => {
    const result = applyShopForFilter({
      lists: [shared],
      participantIds: ['m1', 'm2'],
      selectedIds: null,
    })
    expect(typeof result[0]?.scaledItems[1]?.quantity).toBe('number')
    expect(result[0]?.scaledItems[1]?.quantity).toBe(8)
  })

  it('avoids divide-by-zero when participantIds is empty', () => {
    const result = applyShopForFilter({
      lists: [shared],
      participantIds: [],
      // Some legacy menu somehow has no participants but the user is still
      // filtering — selection here can't refer to anyone, so we fall through
      // to the no-filter ratio.
      selectedIds: ['m1'],
    })
    expect(result[0]?.scaledItems[0]?.quantity).toBe(400)
  })

  it('preserves scheduled_purchase_day through scaling', () => {
    const sharedWithDay = list({
      id: 'shared',
      targetMemberId: null,
      items: [
        { id: 'i1', ingredientId: 'ing-a', quantity: 400, day: 'tuesday' },
      ],
    })
    const result = applyShopForFilter({
      lists: [sharedWithDay],
      participantIds: ['m1', 'm2'],
      selectedIds: ['m1'],
    })
    expect(result[0]?.scaledItems[0]?.scheduled_purchase_day).toBe('tuesday')
  })
})

// ── aggregateHouseholdGrocery (item 8) ──────────────────────────────────────

describe('aggregateHouseholdGrocery', () => {
  it('uses the shared list as the total — does NOT double-count per-member lists', () => {
    // shared already = the household total; per-member is a breakdown of it.
    const shared = list({
      id: 'shared',
      targetMemberId: null,
      items: [
        { id: 's1', ingredientId: 'ing-a', quantity: 400 },
        { id: 's2', ingredientId: 'ing-b', quantity: 8, unit: 'piece' },
      ],
    })
    const alice = list({
      id: 'alice',
      targetMemberId: 'm1',
      items: [{ id: 'a1', ingredientId: 'ing-a', quantity: 200 }],
    })
    const result = aggregateHouseholdGrocery({ lists: [shared, alice] })
    expect(result.target_member_id).toBeNull()
    const a = result.scaledItems.find((i) => i.ingredient_id === 'ing-a')
    expect(a?.quantity).toBe(400) // NOT 600
    expect(result.scaledItems).toHaveLength(2)
  })

  it('unions per-member lists when there is no shared list', () => {
    const alice = list({
      id: 'alice',
      targetMemberId: 'm1',
      items: [{ id: 'a1', ingredientId: 'ing-a', quantity: 200, unit: 'g' }],
    })
    const bob = list({
      id: 'bob',
      targetMemberId: 'm2',
      items: [{ id: 'b1', ingredientId: 'ing-a', quantity: 150, unit: 'g' }],
    })
    const result = aggregateHouseholdGrocery({ lists: [alice, bob] })
    const a = result.scaledItems.find((i) => i.ingredient_id === 'ing-a')
    expect(a?.quantity).toBe(350)
    expect(result.scaledItems).toHaveLength(1)
  })

  it('keeps mismatched units as separate lines', () => {
    const shared = list({
      id: 'shared',
      targetMemberId: null,
      items: [
        { id: 's1', ingredientId: 'ing-a', quantity: 2, unit: 'cup' },
        { id: 's2', ingredientId: 'ing-a', quantity: 100, unit: 'g' },
      ],
    })
    const result = aggregateHouseholdGrocery({ lists: [shared] })
    expect(result.scaledItems).toHaveLength(2)
  })

  it('folds scheduled_purchase_day to the earliest (Mon-first)', () => {
    const alice = list({
      id: 'alice',
      targetMemberId: 'm1',
      items: [{ id: 'a1', ingredientId: 'ing-a', quantity: 1, unit: 'g', day: 'friday' }],
    })
    const bob = list({
      id: 'bob',
      targetMemberId: 'm2',
      items: [{ id: 'b1', ingredientId: 'ing-a', quantity: 1, unit: 'g', day: 'tuesday' }],
    })
    const result = aggregateHouseholdGrocery({ lists: [alice, bob] })
    expect(result.scaledItems[0]?.scheduled_purchase_day).toBe('tuesday')
  })
})

// ── annotateWithInventory (§17) ─────────────────────────────────────────────

describe('annotateWithInventory', () => {
  const items = [
    { id: 'i1', ingredient_id: 'tomato', quantity: 5, unit: 'piece', scheduled_purchase_day: null },
    { id: 'i2', ingredient_id: 'rice', quantity: 200, unit: 'g', scheduled_purchase_day: null },
  ]

  it('annotates on-hand + suggested-to-buy without lowering required', () => {
    const out = annotateWithInventory({
      items,
      inventory: [{ ingredient_id: 'tomato', unit: 'piece', quantity: 2 }],
    })
    const tomato = out.find((i) => i.ingredient_id === 'tomato')!
    expect(tomato.quantity).toBe(5) // required untouched
    expect(tomato.onHand).toBe(2)
    expect(tomato.suggestedToBuy).toBe(3)
    expect(tomato.fullyCovered).toBe(false)
  })

  it('marks a line fully covered when on-hand >= required', () => {
    const out = annotateWithInventory({
      items,
      inventory: [{ ingredient_id: 'tomato', unit: 'piece', quantity: 9 }],
    })
    const tomato = out.find((i) => i.ingredient_id === 'tomato')!
    expect(tomato.suggestedToBuy).toBe(0)
    expect(tomato.fullyCovered).toBe(true)
  })

  it('does not offset across mismatched units', () => {
    const out = annotateWithInventory({
      items,
      inventory: [{ ingredient_id: 'rice', unit: 'cup', quantity: 3 }],
    })
    const rice = out.find((i) => i.ingredient_id === 'rice')!
    expect(rice.onHand).toBe(0)
    expect(rice.suggestedToBuy).toBe(200)
  })

  it('sums multiple inventory rows for the same (ingredient, unit)', () => {
    const out = annotateWithInventory({
      items,
      inventory: [
        { ingredient_id: 'tomato', unit: 'piece', quantity: 1 },
        { ingredient_id: 'tomato', unit: 'piece', quantity: 2 },
      ],
    })
    const tomato = out.find((i) => i.ingredient_id === 'tomato')!
    expect(tomato.onHand).toBe(3)
    expect(tomato.suggestedToBuy).toBe(2)
  })

  it('leaves lines with no inventory at onHand 0', () => {
    const out = annotateWithInventory({ items, inventory: [] })
    expect(out.every((i) => i.onHand === 0)).toBe(true)
    expect(out[0]?.suggestedToBuy).toBe(5)
  })
})
