import { describe, expect, it } from 'vitest'
import { pickMealKey } from '../menu-slot-key'

describe('pickMealKey', () => {
  it('returns the meal_type when the bucket is empty', () => {
    expect(pickMealKey({ mealType: 'breakfast', existingKeys: [] })).toBe(
      'breakfast',
    )
  })

  it('returns meal_type when only an unrelated meal_type is taken', () => {
    expect(
      pickMealKey({ mealType: 'breakfast', existingKeys: ['lunch'] }),
    ).toBe('breakfast')
  })

  it('returns {meal_type}_2 for the second occurrence', () => {
    expect(
      pickMealKey({ mealType: 'breakfast', existingKeys: ['breakfast'] }),
    ).toBe('breakfast_2')
  })

  it('skips taken numbered keys and returns the next free one', () => {
    expect(
      pickMealKey({
        mealType: 'breakfast',
        existingKeys: ['breakfast', 'breakfast_2', 'breakfast_3'],
      }),
    ).toBe('breakfast_4')
  })

  it('throws when 7 occurrences of the same meal_type are already taken', () => {
    expect(() =>
      pickMealKey({
        mealType: 'snack',
        existingKeys: [
          'snack',
          'snack_2',
          'snack_3',
          'snack_4',
          'snack_5',
          'snack_6',
          'snack_7',
        ],
      }),
    ).toThrow(/no free meal_key slot/)
  })
})
