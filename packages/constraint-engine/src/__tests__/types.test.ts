import { describe, expect, it } from 'vitest'
import type { GenerateMenuInput, GenerateMenuResult } from '../types.js'

// ARCHITECTURE_PRD §4.2: every value crossing the engine boundary must
// round-trip losslessly through JSON.stringify / JSON.parse.

describe('public types are JSON-serializable', () => {
  it('GenerateMenuInput round-trips losslessly', () => {
    const input: GenerateMenuInput = {
      workspace: { id: 'w1', type: 'individual', name: 'Home' },
      members: [
        {
          id: 'm1',
          name: 'Alice',
          role: 'creator',
          ageCategory: 'adult',
          dietaryRestrictions: ['vegan'],
          allergies: [],
          ingredientDislikes: [],
          dietaryPreferences: { tags: ['high_protein'], ingredients: ['i-fish'] },
        },
      ],
      recipes: [],
      ingredients: [],
      weekStartDate: '2026-06-01',
      seed: 42,
      options: {
        calorieTolerance: 100,
        ingredientExclusions: ['mushroom'],
        additionalDietaryRestrictions: ['low_sodium'],
        additionalAllergies: ['sesame'],
        additionalDietaryPreferences: { tags: ['pescatarian'], ingredients: ['i-salmon'] },
        relaxedDietaryRestrictions: ['low_sodium'],
        relaxedAllergies: ['sesame'],
      },
    }
    const roundTripped = JSON.parse(JSON.stringify(input)) as GenerateMenuInput
    expect(roundTripped).toEqual(input)
  })

  it('GenerateMenuResult (failure) round-trips losslessly', () => {
    const result: GenerateMenuResult = {
      ok: false,
      error: {
        failedConstraint: 'no_valid_recipe',
        scope: 'member',
        affectedMemberId: 'm1',
        affectedMeal: { day: 'tuesday', mealKey: 'dinner' },
        reasonCode: 'DIETARY_FILTERED_OUT_ALL_CANDIDATES',
        humanMessage: 'No valid dinner recipe found for vegan member.',
      },
    }
    const roundTripped = JSON.parse(JSON.stringify(result)) as GenerateMenuResult
    expect(roundTripped).toEqual(result)
  })

  it('GenerateMenuResult (success) round-trips losslessly', () => {
    const result: GenerateMenuResult = {
      ok: true,
      inputsHash: 'abc123',
      menu: {
        weekStartDate: '2026-06-01',
        seed: 42,
        slots: [
          {
            dayOfWeek: 'monday',
            mealKey: 'breakfast',
            mealType: 'breakfast',
            recipeId: 'r1',
            targetMemberId: null,
          },
        ],
      },
      groceryLists: {
        shared: { targetMemberId: null, items: [] },
        perMember: {},
      },
    }
    const roundTripped = JSON.parse(JSON.stringify(result)) as GenerateMenuResult
    expect(roundTripped).toEqual(result)
  })
})
