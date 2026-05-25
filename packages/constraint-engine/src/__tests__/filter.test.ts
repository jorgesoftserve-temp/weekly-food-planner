import { describe, expect, it } from 'vitest'
import {
  makeIngredient,
  makeMember,
  makeRecipe,
  makeRecipeIngredient,
} from '../test-utils/index.js'
import { createFilterContext, isRecipeValidForSlot } from '../filter.js'
import type { RecipeSnapshot } from '../types.js'
import type { SlotSpec } from '../slots.js'

const veganMember = makeMember({
  role: 'member',
  dietaryRestrictions: ['vegan'],
  allergies: ['peanut'],
})

const peanutIngredient = makeIngredient({
  id: 'i-peanut',
  name: 'Peanut',
  allergens: ['peanut'],
})

const tofuIngredient = makeIngredient({
  id: 'i-tofu',
  name: 'Tofu',
  isPerishable: true,
  maxStorageDays: 7,
  allergens: ['soy'],
})

const veganTofuRecipe = makeRecipe({
  id: 'r-veg-1',
  name: 'Tofu stir-fry',
  ingredients: [makeRecipeIngredient({ ingredientId: 'i-tofu' })],
  dietaryTags: ['vegan'],
})

const slot: SlotSpec = {
  dayOfWeek: 'monday',
  mealKey: 'dinner',
  mealType: 'dinner',
  targetMemberId: 'm1',
}

describe('isRecipeValidForSlot', () => {
  it('passes when recipe meets dietary tag and has no allergens', () => {
    const ctx = createFilterContext({
      member: veganMember,
      options: undefined,
      ingredients: [tofuIngredient, peanutIngredient],
    })
    expect(isRecipeValidForSlot({ recipe: veganTofuRecipe, slot, ctx })).toBe(true)
  })

  it('fails when recipe lacks required dietary tag', () => {
    const meatyRecipe: RecipeSnapshot = { ...veganTofuRecipe, dietaryTags: [] }
    const ctx = createFilterContext({
      member: veganMember,
      options: undefined,
      ingredients: [tofuIngredient],
    })
    expect(isRecipeValidForSlot({ recipe: meatyRecipe, slot, ctx })).toBe(false)
  })

  it('fails when recipe contains a member-allergen ingredient', () => {
    const peanutRecipe: RecipeSnapshot = {
      ...veganTofuRecipe,
      ingredients: [
        makeRecipeIngredient({ ingredientId: 'i-peanut', quantity: 1, unit: 'tbsp' }),
      ],
    }
    const ctx = createFilterContext({
      member: veganMember,
      options: undefined,
      ingredients: [peanutIngredient],
    })
    expect(isRecipeValidForSlot({ recipe: peanutRecipe, slot, ctx })).toBe(false)
  })

  it('fails when meal_type does not match the slot', () => {
    const breakfastSlot: SlotSpec = { ...slot, mealType: 'breakfast' }
    const ctx = createFilterContext({
      member: veganMember,
      options: undefined,
      ingredients: [tofuIngredient],
    })
    expect(isRecipeValidForSlot({ recipe: veganTofuRecipe, slot: breakfastSlot, ctx })).toBe(false)
  })

  it('applies overlay additional dietary restrictions on top of profile', () => {
    const member = makeMember({ role: 'member', allergies: ['peanut'] })
    const onlyVegetarianRecipe: RecipeSnapshot = {
      ...veganTofuRecipe,
      dietaryTags: ['vegetarian'],
    }
    const ctx = createFilterContext({
      member,
      options: { additionalDietaryRestrictions: ['vegan'] },
      ingredients: [tofuIngredient],
    })
    expect(isRecipeValidForSlot({ recipe: onlyVegetarianRecipe, slot, ctx })).toBe(false)
  })

  it('applies overlay ingredient exclusions', () => {
    const ctx = createFilterContext({
      member: makeMember({ role: 'member' }),
      options: { ingredientExclusions: ['i-tofu'] },
      ingredients: [tofuIngredient],
    })
    expect(isRecipeValidForSlot({ recipe: veganTofuRecipe, slot, ctx })).toBe(false)
  })
})
