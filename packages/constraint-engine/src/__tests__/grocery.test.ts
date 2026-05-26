import { describe, expect, it } from 'vitest'
import {
  makeRecipe,
  makeRecipeIngredient,
} from '../test-utils/index.js'
import { aggregateGroceryLists } from '../grocery.js'
import type { SlotAssignment } from '../assign.js'

const slot = ({
  memberId,
  day = 'monday',
  mealKey = 'breakfast',
}: {
  memberId: string
  day?: 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday'
  mealKey?: string
}): SlotAssignment['slot'] => ({
  dayOfWeek: day,
  mealKey,
  mealType: 'breakfast',
  targetMemberId: memberId,
})

describe('aggregateGroceryLists / servings scaling', () => {
  it('scales each contribution by (1 / recipe.servings)', () => {
    const recipe = makeRecipe({
      id: 'r1',
      servings: 4,
      ingredients: [
        makeRecipeIngredient({ ingredientId: 'i-flour', quantity: 400, unit: 'g' }),
      ],
    })
    const assignments: SlotAssignment[] = [
      { slot: slot({ memberId: 'm1' }), recipeId: 'r1' },
    ]
    const result = aggregateGroceryLists({ assignments, recipes: [recipe] })
    expect(result.shared.items).toHaveLength(1)
    // 400g flour / 4 servings = 100g for one eater
    expect(result.shared.items[0]?.quantity).toBe(100)
  })

  it('sums per-member contributions into the shared bucket', () => {
    const recipe = makeRecipe({
      id: 'r1',
      servings: 4,
      ingredients: [
        makeRecipeIngredient({ ingredientId: 'i-flour', quantity: 400, unit: 'g' }),
      ],
    })
    const assignments: SlotAssignment[] = [
      { slot: slot({ memberId: 'm1' }), recipeId: 'r1' },
      { slot: slot({ memberId: 'm2' }), recipeId: 'r1' },
    ]
    const result = aggregateGroceryLists({ assignments, recipes: [recipe] })
    // 2 members × 100g per eater = 200g total
    expect(result.shared.items[0]?.quantity).toBe(200)
  })

  it('populates per-member buckets with each members own allocation', () => {
    const recipe = makeRecipe({
      id: 'r1',
      servings: 2,
      ingredients: [
        makeRecipeIngredient({ ingredientId: 'i-rice', quantity: 100, unit: 'g' }),
      ],
    })
    const assignments: SlotAssignment[] = [
      { slot: slot({ memberId: 'm1', day: 'monday' }), recipeId: 'r1' },
      { slot: slot({ memberId: 'm1', day: 'tuesday' }), recipeId: 'r1' },
      { slot: slot({ memberId: 'm2', day: 'monday' }), recipeId: 'r1' },
    ]
    const result = aggregateGroceryLists({ assignments, recipes: [recipe] })
    // m1 used recipe twice: 2 × (100 / 2) = 100g
    expect(result.perMember.m1?.items[0]?.quantity).toBe(100)
    // m2 used recipe once: 1 × (100 / 2) = 50g
    expect(result.perMember.m2?.items[0]?.quantity).toBe(50)
    // shared = sum: 150g
    expect(result.shared.items[0]?.quantity).toBe(150)
  })

  it('falls back to scaling factor 1 when recipe.servings is 0', () => {
    const recipe = makeRecipe({
      id: 'r1',
      servings: 0,
      ingredients: [
        makeRecipeIngredient({ ingredientId: 'i-x', quantity: 5, unit: 'cup' }),
      ],
    })
    const assignments: SlotAssignment[] = [
      { slot: slot({ memberId: 'm1' }), recipeId: 'r1' },
    ]
    const result = aggregateGroceryLists({ assignments, recipes: [recipe] })
    // Guard divides by 1 instead of 0, surfacing raw quantity.
    expect(result.shared.items[0]?.quantity).toBe(5)
  })

  it('emits an empty perMember map and empty shared list for no assignments', () => {
    const result = aggregateGroceryLists({ assignments: [], recipes: [] })
    expect(result.shared.items).toEqual([])
    expect(result.perMember).toEqual({})
  })

  it('JSON round-trips losslessly (engine boundary contract)', () => {
    const recipe = makeRecipe({
      id: 'r1',
      servings: 4,
      ingredients: [
        makeRecipeIngredient({ ingredientId: 'i-flour', quantity: 400 }),
      ],
    })
    const result = aggregateGroceryLists({
      assignments: [
        { slot: slot({ memberId: 'm1' }), recipeId: 'r1' },
        { slot: slot({ memberId: 'm2' }), recipeId: 'r1' },
      ],
      recipes: [recipe],
    })
    const round = JSON.parse(JSON.stringify(result))
    expect(round).toEqual(result)
  })
})
