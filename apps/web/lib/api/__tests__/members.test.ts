import { describe, expect, it } from 'vitest'
import {
  createMemberBodySchema,
  formatZodError,
  ingredientIdsBodySchema,
  updateMemberBodySchema,
  valuesBodySchema,
} from '../members'

describe('createMemberBodySchema', () => {
  it('accepts a minimal valid body', () => {
    const result = createMemberBodySchema.safeParse({
      name: 'Alice',
      role: 'member',
      age_category: 'adult',
    })
    expect(result.success).toBe(true)
  })

  it('rejects an empty name', () => {
    const result = createMemberBodySchema.safeParse({
      name: '   ',
      role: 'member',
      age_category: 'adult',
    })
    expect(result.success).toBe(false)
  })

  it('rejects role=creator (signup trigger owns it)', () => {
    const result = createMemberBodySchema.safeParse({
      name: 'Alice',
      role: 'creator',
      age_category: 'adult',
    })
    expect(result.success).toBe(false)
  })

  it('rejects unknown age_category', () => {
    const result = createMemberBodySchema.safeParse({
      name: 'Alice',
      role: 'member',
      age_category: 'middle_aged',
    })
    expect(result.success).toBe(false)
  })

  it('rejects duplicate meal_frequency keys', () => {
    const result = createMemberBodySchema.safeParse({
      name: 'Alice',
      role: 'member',
      age_category: 'adult',
      meal_frequency: [
        { key: 'breakfast', title: 'Breakfast', mealType: 'breakfast', defaultHour: 7 },
        { key: 'breakfast', title: 'Brunch', mealType: 'breakfast', defaultHour: 10 },
      ],
    })
    expect(result.success).toBe(false)
  })

  it('rejects defaultHour out of [0..23]', () => {
    const result = createMemberBodySchema.safeParse({
      name: 'Alice',
      role: 'member',
      age_category: 'adult',
      meal_frequency: [
        { key: 'breakfast', title: 'Breakfast', mealType: 'breakfast', defaultHour: 24 },
      ],
    })
    expect(result.success).toBe(false)
  })

  it('accepts a null daily_calorie_target', () => {
    const result = createMemberBodySchema.safeParse({
      name: 'Alice',
      role: 'member',
      age_category: 'adult',
      daily_calorie_target: null,
    })
    expect(result.success).toBe(true)
  })

  it('rejects a non-positive daily_calorie_target', () => {
    const result = createMemberBodySchema.safeParse({
      name: 'Alice',
      role: 'member',
      age_category: 'adult',
      daily_calorie_target: 0,
    })
    expect(result.success).toBe(false)
  })
})

describe('updateMemberBodySchema', () => {
  it('rejects empty patch', () => {
    const result = updateMemberBodySchema.safeParse({})
    expect(result.success).toBe(false)
  })

  it('accepts a single-field patch', () => {
    const result = updateMemberBodySchema.safeParse({ name: 'Bob' })
    expect(result.success).toBe(true)
  })

  it('rejects role=creator on update', () => {
    const result = updateMemberBodySchema.safeParse({ role: 'creator' })
    expect(result.success).toBe(false)
  })
})

describe('valuesBodySchema', () => {
  it('accepts an empty array (clears all values)', () => {
    const result = valuesBodySchema.safeParse({ values: [] })
    expect(result.success).toBe(true)
  })

  it('rejects whitespace-only values', () => {
    const result = valuesBodySchema.safeParse({ values: [' '] })
    expect(result.success).toBe(false)
  })
})

describe('ingredientIdsBodySchema', () => {
  it('accepts UUID array', () => {
    const result = ingredientIdsBodySchema.safeParse({
      ingredient_ids: ['550e8400-e29b-41d4-a716-446655440000'],
    })
    expect(result.success).toBe(true)
  })

  it('rejects non-UUID strings', () => {
    const result = ingredientIdsBodySchema.safeParse({
      ingredient_ids: ['not-a-uuid'],
    })
    expect(result.success).toBe(false)
  })
})

describe('formatZodError', () => {
  it('produces a readable single-line message', () => {
    const result = createMemberBodySchema.safeParse({ role: 'member', age_category: 'adult' })
    if (result.success) throw new Error('expected failure')
    const message = formatZodError(result.error)
    expect(message).toContain('name')
  })
})
