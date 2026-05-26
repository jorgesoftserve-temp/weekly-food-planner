import { describe, expect, it } from 'vitest'
import type { GroceryListRecord } from '@weekly-food-planner/supabase'
import { buildExportGroceryLists } from '../menu-export-loader'

const list = (
  id: string,
  targetMemberId: string | null,
  items: GroceryListRecord['grocery_items'],
): GroceryListRecord => ({ id, target_member_id: targetMemberId, grocery_items: items })

const item = (
  id: string,
  ingredientId: string,
  quantity: number,
  unit: 'g' | 'piece' | 'cup' = 'piece',
  scheduledPurchaseDay: string | null = null,
): GroceryListRecord['grocery_items'][number] => ({
  id,
  ingredient_id: ingredientId,
  quantity,
  unit,
  scheduled_purchase_day: scheduledPurchaseDay,
})

describe('buildExportGroceryLists', () => {
  it('reshapes lists into the export schema with no filter when shopForIds is null', () => {
    const result = buildExportGroceryLists({
      lists: [list('gl-shared', null, [item('gi-1', 'i-tomato', 4)])],
      participantIds: ['m-a', 'm-b'],
      shopForIds: null,
    })
    expect(result).toEqual([
      {
        targetMemberId: null,
        items: [
          {
            ingredientId: 'i-tomato',
            quantity: 4,
            unit: 'piece',
            scheduledPurchaseDay: null,
          },
        ],
      },
    ])
  })

  it('passes through unchanged when shopForIds equals the full participant set', () => {
    const result = buildExportGroceryLists({
      lists: [
        list('gl-shared', null, [item('gi-1', 'i-tomato', 4)]),
        list('gl-a', 'm-a', [item('gi-2', 'i-oats', 2)]),
        list('gl-b', 'm-b', [item('gi-3', 'i-oats', 2)]),
      ],
      participantIds: ['m-a', 'm-b'],
      shopForIds: ['m-a', 'm-b'],
    })
    expect(result).toHaveLength(3)
    const shared = result.find((l) => l.targetMemberId === null)
    expect(shared?.items[0]?.quantity).toBe(4)
  })

  it('scales the shared bucket and drops unselected per-member buckets when shopForIds is a strict subset', () => {
    const result = buildExportGroceryLists({
      lists: [
        list('gl-shared', null, [item('gi-1', 'i-tomato', 4)]),
        list('gl-a', 'm-a', [item('gi-2', 'i-oats', 2)]),
        list('gl-b', 'm-b', [item('gi-3', 'i-oats', 2)]),
      ],
      participantIds: ['m-a', 'm-b'],
      shopForIds: ['m-a'],
    })
    const shared = result.find((l) => l.targetMemberId === null)
    const perA = result.find((l) => l.targetMemberId === 'm-a')
    const perB = result.find((l) => l.targetMemberId === 'm-b')
    // shared scales by selectedCount / participantCount = 1/2 → 4 * 0.5 = 2
    expect(shared?.items[0]?.quantity).toBe(2)
    // m-a survives untouched (per-member bucket is already 1 eater)
    expect(perA?.items[0]?.quantity).toBe(2)
    // m-b is filtered out
    expect(perB).toBeUndefined()
  })

  it('coerces string quantities (Postgres numeric) into numbers', () => {
    const result = buildExportGroceryLists({
      lists: [
        {
          id: 'gl-shared',
          target_member_id: null,
          grocery_items: [
            {
              id: 'gi-1',
              ingredient_id: 'i-tomato',
              quantity: '3.5' as unknown as number,
              unit: 'piece',
              scheduled_purchase_day: null,
            },
          ],
        },
      ],
      participantIds: ['m-a'],
      shopForIds: null,
    })
    expect(result[0]?.items[0]?.quantity).toBe(3.5)
  })

  it('returns [] when no grocery lists exist', () => {
    const result = buildExportGroceryLists({
      lists: [],
      participantIds: ['m-a'],
      shopForIds: ['m-a'],
    })
    expect(result).toEqual([])
  })

  it('treats empty shopForIds the same as null (no-op pass-through)', () => {
    const result = buildExportGroceryLists({
      lists: [
        list('gl-shared', null, [item('gi-1', 'i-tomato', 4)]),
        list('gl-b', 'm-b', [item('gi-3', 'i-oats', 2)]),
      ],
      participantIds: ['m-a', 'm-b'],
      shopForIds: [],
    })
    expect(result).toHaveLength(2)
  })
})
