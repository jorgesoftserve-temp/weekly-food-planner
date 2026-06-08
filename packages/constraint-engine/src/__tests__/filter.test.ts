import { describe, expect, it } from 'vitest'
import {
  makeIngredient,
  makeMember,
  makeRecipe,
  makeRecipeIngredient,
} from '../test-utils/index.js'
import { createFilterContext, describeRecipeEligibility, isRecipeValidForSlot } from '../filter.js'
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

describe('describeRecipeEligibility', () => {
  // 1. Fully eligible: vegan member + vegan tofu recipe, no overlay
  it('returns eligible with empty blockedBy when all constraints are satisfied', () => {
    const ctx = createFilterContext({
      member: veganMember,
      options: undefined,
      ingredients: [tofuIngredient, peanutIngredient],
    })
    const result = describeRecipeEligibility({ recipe: veganTofuRecipe, ctx })
    expect(result).toEqual({ eligible: true, blockedBy: [] })
  })

  // 2. forMealType mismatch does NOT short-circuit — other blockers are still collected
  it('reports meal_type_mismatch and continues to collect further blockers', () => {
    const peanutDinnerRecipe: RecipeSnapshot = {
      ...veganTofuRecipe,
      mealType: 'dinner',
      ingredients: [makeRecipeIngredient({ ingredientId: 'i-peanut', quantity: 1, unit: 'tbsp' })],
      dietaryTags: ['vegan'],
    }
    const ctx = createFilterContext({
      member: veganMember, // has peanut allergy
      options: undefined,
      ingredients: [peanutIngredient],
    })
    const result = describeRecipeEligibility({ recipe: peanutDinnerRecipe, ctx, forMealType: 'breakfast' })
    expect(result.eligible).toBe(false)
    expect(result.blockedBy).toContainEqual({ kind: 'meal_type_mismatch', expected: 'breakfast', actual: 'dinner' })
    expect(result.blockedBy).toContainEqual({ kind: 'allergen_present', allergen: 'peanut', viaIngredientId: 'i-peanut' })
  })

  // 3. forMealType omitted: no meal-type check even if recipe mealType would not match
  it('skips meal-type check when forMealType is omitted', () => {
    // veganTofuRecipe has mealType 'dinner'; we never supply forMealType
    const ctx = createFilterContext({
      member: veganMember,
      options: undefined,
      ingredients: [tofuIngredient],
    })
    const result = describeRecipeEligibility({ recipe: veganTofuRecipe, ctx })
    const hasMealTypeMismatch = result.blockedBy.some(b => b.kind === 'meal_type_mismatch')
    expect(hasMealTypeMismatch).toBe(false)
  })

  // 4. Missing dietary tag via member profile
  it('reports missing_dietary_tag when recipe lacks a required dietary tag', () => {
    const vegetarianRecipe: RecipeSnapshot = { ...veganTofuRecipe, dietaryTags: ['vegetarian'] }
    const ctx = createFilterContext({
      member: makeMember({ role: 'member', dietaryRestrictions: ['vegan'] }),
      options: undefined,
      ingredients: [tofuIngredient],
    })
    const result = describeRecipeEligibility({ recipe: vegetarianRecipe, ctx })
    expect(result.eligible).toBe(false)
    expect(result.blockedBy).toContainEqual({ kind: 'missing_dietary_tag', tag: 'vegan' })
  })

  // 5. Excluded ingredient via options
  it('reports excluded_ingredient when a recipe ingredient is in the exclusion list', () => {
    const ctx = createFilterContext({
      member: makeMember({ role: 'member' }),
      options: { ingredientExclusions: ['i-tofu'] },
      ingredients: [tofuIngredient],
    })
    const result = describeRecipeEligibility({ recipe: veganTofuRecipe, ctx })
    expect(result.eligible).toBe(false)
    expect(result.blockedBy).toContainEqual({ kind: 'excluded_ingredient', ingredientId: 'i-tofu' })
  })

  // 6. Allergen present via member profile
  it('reports allergen_present when recipe contains an ingredient with a member allergen', () => {
    const peanutRecipe: RecipeSnapshot = {
      ...veganTofuRecipe,
      ingredients: [makeRecipeIngredient({ ingredientId: 'i-peanut', quantity: 1, unit: 'tbsp' })],
    }
    const ctx = createFilterContext({
      member: makeMember({ role: 'member', allergies: ['peanut'] }),
      options: undefined,
      ingredients: [peanutIngredient],
    })
    const result = describeRecipeEligibility({ recipe: peanutRecipe, ctx })
    expect(result.eligible).toBe(false)
    expect(result.blockedBy).toContainEqual({ kind: 'allergen_present', allergen: 'peanut', viaIngredientId: 'i-peanut' })
  })

  // 7. Multiple blockers stacked: dietary-tag miss + allergen + excluded ingredient
  it('collects all three blocker kinds simultaneously', () => {
    const problematicRecipe: RecipeSnapshot = {
      ...veganTofuRecipe,
      // missing 'vegan' tag
      dietaryTags: ['vegetarian'],
      // contains both tofu (excluded) and peanut (allergen)
      ingredients: [
        makeRecipeIngredient({ ingredientId: 'i-tofu' }),
        makeRecipeIngredient({ ingredientId: 'i-peanut', quantity: 1, unit: 'tbsp' }),
      ],
    }
    const ctx = createFilterContext({
      member: makeMember({ role: 'member', dietaryRestrictions: ['vegan'], allergies: ['peanut'] }),
      options: { ingredientExclusions: ['i-tofu'] },
      ingredients: [tofuIngredient, peanutIngredient],
    })
    const result = describeRecipeEligibility({ recipe: problematicRecipe, ctx })
    expect(result.eligible).toBe(false)
    expect(result.blockedBy).toContainEqual({ kind: 'missing_dietary_tag', tag: 'vegan' })
    expect(result.blockedBy).toContainEqual({ kind: 'excluded_ingredient', ingredientId: 'i-tofu' })
    expect(result.blockedBy).toContainEqual({ kind: 'allergen_present', allergen: 'peanut', viaIngredientId: 'i-peanut' })
    expect(result.blockedBy).toHaveLength(3)
  })

  // 8. Overlay restrictions/allergies/exclusions union with member profile
  it('unions overlay additionalDietaryRestrictions, additionalAllergies with member profile', () => {
    // member has no dietary restrictions or allergies
    const overlayMember = makeMember({ role: 'member' })
    const problematicRecipe: RecipeSnapshot = {
      ...veganTofuRecipe,
      // missing 'gluten-free' which will come from overlay
      dietaryTags: ['vegan'],
      ingredients: [makeRecipeIngredient({ ingredientId: 'i-peanut', quantity: 1, unit: 'tbsp' })],
    }
    const ctx = createFilterContext({
      member: overlayMember,
      options: {
        additionalDietaryRestrictions: ['gluten-free'],
        additionalAllergies: ['peanut'],
      },
      ingredients: [peanutIngredient],
    })
    const result = describeRecipeEligibility({ recipe: problematicRecipe, ctx })
    expect(result.eligible).toBe(false)
    expect(result.blockedBy).toContainEqual({ kind: 'missing_dietary_tag', tag: 'gluten-free' })
    expect(result.blockedBy).toContainEqual({ kind: 'allergen_present', allergen: 'peanut', viaIngredientId: 'i-peanut' })
  })
})
