import { describe, expect, it } from 'vitest'
import {
  computeShoppingCompleteness,
  shoppingStatusForCompleteness,
} from '../shopping-finalize'

// Minimal item shape — computeShoppingCompleteness only reads acquired_quantity
// and grocery_item.quantity. The rest of ShoppingItemStatusRecord is irrelevant.
const line = (acquired: number, required: number) =>
  ({
    acquired_quantity: acquired,
    grocery_item: {
      id: 'gi',
      ingredient_id: 'ing',
      quantity: required,
      unit: 'piece' as const,
      ingredient: null,
    },
  }) as Parameters<typeof computeShoppingCompleteness>[0]['items'][number]

describe('computeShoppingCompleteness', () => {
  it('is 100 when every line is acquired at full quantity', () => {
    expect(
      computeShoppingCompleteness({ items: [line(5, 5), line(2, 2)] }),
    ).toBe(100)
  })

  it('is 0 when nothing is acquired', () => {
    expect(
      computeShoppingCompleteness({ items: [line(0, 5), line(0, 2)] }),
    ).toBe(0)
  })

  it('is quantity-weighted, not line-counted (3 of 5 → 60)', () => {
    expect(computeShoppingCompleteness({ items: [line(3, 5)] })).toBe(60)
  })

  it('weights by total quantity across lines', () => {
    // acquired 5+0 = 5 of required 5+5 = 10 → 50
    expect(
      computeShoppingCompleteness({ items: [line(5, 5), line(0, 5)] }),
    ).toBe(50)
  })

  it('caps an over-bought line to required so it cannot exceed 100', () => {
    // line A over-bought (10 of 5) must not offset line B's shortfall
    expect(
      computeShoppingCompleteness({ items: [line(10, 5), line(0, 5)] }),
    ).toBe(50)
  })

  it('guards against a zero required quantity (no divide-by-zero)', () => {
    expect(computeShoppingCompleteness({ items: [line(0, 0)] })).toBe(0)
  })

  it('skips lines with a missing grocery_item join', () => {
    const items = [
      line(5, 5),
      { acquired_quantity: 3, grocery_item: null } as Parameters<
        typeof computeShoppingCompleteness
      >[0]['items'][number],
    ]
    expect(computeShoppingCompleteness({ items })).toBe(100)
  })
})

describe('shoppingStatusForCompleteness', () => {
  it('is complete at exactly 90', () => {
    expect(shoppingStatusForCompleteness(90)).toBe('complete')
  })

  it('is complete above 90', () => {
    expect(shoppingStatusForCompleteness(100)).toBe('complete')
  })

  it('is incomplete just below 90', () => {
    expect(shoppingStatusForCompleteness(89.99)).toBe('incomplete')
  })

  it('is incomplete in the barely-shopped band (<30)', () => {
    expect(shoppingStatusForCompleteness(12)).toBe('incomplete')
  })
})
