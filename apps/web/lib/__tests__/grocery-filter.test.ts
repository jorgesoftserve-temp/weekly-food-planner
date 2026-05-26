import { describe, expect, it } from 'vitest'
import type { GroceryListRecord } from '@weekly-food-planner/supabase'
import { applyShopForFilter } from '../grocery-filter'

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
