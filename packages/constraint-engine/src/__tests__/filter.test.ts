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

  it('fails when slot meal type is not in the recipe meal-types set', () => {
    // veganTofuRecipe is a one-element ['dinner'] set — proves the backfill
    // (scalar→one-element array) behaves exactly like the old scalar equality.
    const breakfastSlot: SlotSpec = { ...slot, mealType: 'breakfast' }
    const ctx = createFilterContext({
      member: veganMember,
      options: undefined,
      ingredients: [tofuIngredient],
    })
    expect(isRecipeValidForSlot({ recipe: veganTofuRecipe, slot: breakfastSlot, ctx })).toBe(false)
  })

  it('passes when the slot meal type is one of several recipe meal-types (multi-timeframe)', () => {
    // v2.1: a recipe eligible for breakfast + dinner is a candidate for either.
    const multiTimeframeRecipe: RecipeSnapshot = {
      ...veganTofuRecipe,
      mealTypes: ['breakfast', 'dinner'],
    }
    const breakfastSlot: SlotSpec = { ...slot, mealType: 'breakfast' }
    const ctx = createFilterContext({
      member: veganMember,
      options: undefined,
      ingredients: [tofuIngredient],
    })
    expect(isRecipeValidForSlot({ recipe: multiTimeframeRecipe, slot, ctx })).toBe(true)
    expect(isRecipeValidForSlot({ recipe: multiTimeframeRecipe, slot: breakfastSlot, ctx })).toBe(true)
  })

  it('fails when the slot meal type is in none of several recipe meal-types', () => {
    const multiTimeframeRecipe: RecipeSnapshot = {
      ...veganTofuRecipe,
      mealTypes: ['breakfast', 'snack'],
    }
    const ctx = createFilterContext({
      member: veganMember,
      options: undefined,
      ingredients: [tofuIngredient],
    })
    // slot is a 'dinner' slot — not in ['breakfast','snack']
    expect(isRecipeValidForSlot({ recipe: multiTimeframeRecipe, slot, ctx })).toBe(false)
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

  // v2.1: relaxed* subtracts a profile hard restriction/allergy for this generation only.
  it('relaxedDietaryRestrictions lifts a profile dietary restriction for this generation', () => {
    // vegan member; a vegetarian-only recipe normally fails the vegan hard tag.
    const vegetarianRecipe: RecipeSnapshot = { ...veganTofuRecipe, dietaryTags: ['vegetarian'] }
    const blockedCtx = createFilterContext({
      member: veganMember,
      options: undefined,
      ingredients: [tofuIngredient],
    })
    expect(isRecipeValidForSlot({ recipe: vegetarianRecipe, slot, ctx: blockedCtx })).toBe(false)

    const relaxedCtx = createFilterContext({
      member: veganMember,
      options: { relaxedDietaryRestrictions: ['vegan'] },
      ingredients: [tofuIngredient],
    })
    expect(isRecipeValidForSlot({ recipe: vegetarianRecipe, slot, ctx: relaxedCtx })).toBe(true)
  })

  it('relaxedAllergies lifts a profile allergy for this generation', () => {
    // veganMember is allergic to peanut; a peanut recipe normally fails.
    const peanutRecipe: RecipeSnapshot = {
      ...veganTofuRecipe,
      ingredients: [makeRecipeIngredient({ ingredientId: 'i-peanut', quantity: 1, unit: 'tbsp' })],
    }
    const blockedCtx = createFilterContext({
      member: veganMember,
      options: undefined,
      ingredients: [peanutIngredient],
    })
    expect(isRecipeValidForSlot({ recipe: peanutRecipe, slot, ctx: blockedCtx })).toBe(false)

    const relaxedCtx = createFilterContext({
      member: veganMember,
      options: { relaxedAllergies: ['peanut'] },
      ingredients: [peanutIngredient],
    })
    expect(isRecipeValidForSlot({ recipe: peanutRecipe, slot, ctx: relaxedCtx })).toBe(true)
  })

  it('relaxedAllergies overrides an overlay-added allergy (subtraction is applied last)', () => {
    const member = makeMember({ role: 'member' })
    const peanutRecipe: RecipeSnapshot = {
      ...veganTofuRecipe,
      dietaryTags: ['vegan'],
      ingredients: [makeRecipeIngredient({ ingredientId: 'i-peanut', quantity: 1, unit: 'tbsp' })],
    }
    const ctx = createFilterContext({
      member,
      options: { additionalAllergies: ['peanut'], relaxedAllergies: ['peanut'] },
      ingredients: [peanutIngredient],
    })
    expect(isRecipeValidForSlot({ recipe: peanutRecipe, slot, ctx })).toBe(true)
  })

  it('inclusive preferences never hard-filter (filter.ts ignores them)', () => {
    // A member with a fish preference but a recipe with no fish is still valid.
    const member = makeMember({
      role: 'member',
      dietaryPreferences: { tags: ['pescatarian'], ingredients: ['i-fish'] },
    })
    const ctx = createFilterContext({
      member,
      options: { additionalDietaryPreferences: { tags: ['high_protein'], ingredients: ['i-salmon'] } },
      ingredients: [tofuIngredient],
    })
    expect(isRecipeValidForSlot({ recipe: veganTofuRecipe, slot, ctx })).toBe(true)
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
      mealTypes: ['dinner'],
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
    expect(result.blockedBy).toContainEqual({ kind: 'meal_type_mismatch', expected: 'breakfast', actual: ['dinner'] })
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
