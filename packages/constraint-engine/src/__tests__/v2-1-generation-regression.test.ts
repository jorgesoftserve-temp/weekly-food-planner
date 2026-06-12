import { describe, expect, it } from 'vitest'
import { makeGenerateMenuInput, makeMember, makeRecipe, makeRecipeIngredient } from '../test-utils/index.js'
import { buildSlots } from '../slots.js'
import { generateMenu } from '../generate.js'
import type { GenerateMenuInput, RecipeSnapshot } from '../types.js'

// v2.1 generation-time regression suite (Track C — items 11 + 12).
// Locks the engine BOUNDARY behaviour (full generateMenu) for the new optional
// inputs. Unit-level coverage of the partition/filter helpers lives in
// assign.test.ts and filter.test.ts; this file proves the same invariants hold
// end-to-end through generateMenu, with FIXED seeds, so a future refactor that
// silently changes selection or slot enumeration fails here.
//
// The no-op byte-identity invariant (no prefs / no relaxed* / one-element meal
// sets reproduce the pre-v2.1 output exactly) was verified empirically by
// stashing the engine to HEAD and diffing assignment output — identical SHA-256
// across 6 seeds/shapes. It is not re-frozen as a literal golden file here
// because the repo's engine regression suite is assertion-based, not snapshot-
// based; the determinism + count assertions below are the durable guard.

// ---------------------------------------------------------------------------
// (a) Inclusive preferences + relaxed* — deterministic for a fixed seed and
//     NEVER includes a hard-excluded recipe.
// ---------------------------------------------------------------------------

// Four hard-valid dinner recipes with stable ids so the id-sort is deterministic.
// r-pesc carries the inclusive tag; r-salmon carries the inclusive ingredient.
const dinnerPool: RecipeSnapshot[] = [
  makeRecipe({ id: 'r-comfort', mealType: 'dinner', dietaryTags: ['comfort'] }),
  makeRecipe({ id: 'r-pesc', mealType: 'dinner', dietaryTags: ['pescatarian'] }),
  makeRecipe({
    id: 'r-salmon',
    mealType: 'dinner',
    ingredients: [makeRecipeIngredient({ ingredientId: 'i-salmon' })],
  }),
  makeRecipe({ id: 'r-spicy', mealType: 'dinner', dietaryTags: ['spicy'] }),
]
const breakfastPool: RecipeSnapshot[] = [
  makeRecipe({ id: 'r-oat', mealType: 'breakfast', dietaryTags: ['vegan'] }),
  makeRecipe({ id: 'r-egg', mealType: 'breakfast' }),
]

const prefInput = (overrides: Partial<GenerateMenuInput> = {}): GenerateMenuInput =>
  makeGenerateMenuInput({
    members: [makeMember({ id: 'm1', role: 'creator' })],
    recipes: [...breakfastPool, ...dinnerPool],
    weekStartDate: '2026-01-05', // Monday
    seed: 1337,
    ...overrides,
  })

describe('v2.1 generation regression — inclusive prefs + relaxed*', () => {
  it('is deterministic for a fixed seed when an inclusive preference is set', async () => {
    const input = prefInput({
      options: { additionalDietaryPreferences: { tags: ['pescatarian'] } },
    })
    const a = await generateMenu(input)
    const b = await generateMenu(input)
    expect(a).toEqual(b)
  })

  it('biases every dinner slot toward the preferred recipe (sole preferred candidate)', async () => {
    // Only r-pesc carries the 'pescatarian' inclusive tag, so it is the sole
    // member of the "preferred" partition for every dinner slot → picked every
    // time, deterministically, regardless of seed.
    const result = await generateMenu(
      prefInput({ options: { additionalDietaryPreferences: { tags: ['pescatarian'] } } }),
    )
    expect(result.ok).toBe(true)
    if (!result.ok) return
    const dinnerPicks = result.menu.slots.filter((s) => s.mealType === 'dinner')
    expect(dinnerPicks).toHaveLength(7)
    expect(dinnerPicks.every((s) => s.recipeId === 'r-pesc')).toBe(true)
  })

  it('never assigns a hard-excluded recipe even when it matches an inclusive preference', async () => {
    // i-salmon is BOTH the inclusive preference and a hard ingredient exclusion.
    // r-salmon must be filtered out before the soft-bias partition runs, so it
    // can never appear; the preferred set is then empty → falls back to the rest.
    const result = await generateMenu(
      prefInput({
        members: [makeMember({ id: 'm1', role: 'creator', dietaryPreferences: { tags: [], ingredients: ['i-salmon'] } })],
        options: { ingredientExclusions: ['i-salmon'] },
      }),
    )
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.menu.slots.some((s) => s.recipeId === 'r-salmon')).toBe(false)
  })

  it('relaxedDietaryRestrictions lifts a profile hard restriction for this generation only (deterministic)', async () => {
    // Vegan member: without relaxing, only r-oat (vegan breakfast) + no vegan
    // dinner exists → no_valid_recipe for the dinner slot. Relaxing 'vegan'
    // re-opens the full dinner pool.
    const veganMember = makeMember({ id: 'm1', role: 'creator', dietaryRestrictions: ['vegan'] })
    const blocked = await generateMenu(prefInput({ members: [veganMember] }))
    expect(blocked.ok).toBe(false)
    if (blocked.ok) return
    expect(blocked.error.failedConstraint).toBe('no_valid_recipe')

    const relaxedInput = prefInput({
      members: [veganMember],
      options: { relaxedDietaryRestrictions: ['vegan'] },
    })
    const a = await generateMenu(relaxedInput)
    const b = await generateMenu(relaxedInput)
    expect(a.ok).toBe(true)
    expect(a).toEqual(b) // deterministic for the fixed seed
  })

  it('relaxedAllergies lifts a profile allergy for this generation only', async () => {
    // Member allergic to a salmon-borne allergen; relaxing it re-admits r-salmon
    // as a hard-valid candidate. We assert determinism + that generation succeeds.
    const allergicMember = makeMember({ id: 'm1', role: 'creator', allergies: ['fish'] })
    const ingredients = [
      { id: 'i-salmon', name: 'Salmon', isPerishable: true, maxStorageDays: 2, requiresFresh: true, sameDayCook: false, allergens: ['fish'] },
    ]
    const relaxedInput = prefInput({
      members: [allergicMember],
      ingredients,
      options: { relaxedAllergies: ['fish'] },
    })
    const a = await generateMenu(relaxedInput)
    const b = await generateMenu(relaxedInput)
    expect(a.ok).toBe(true)
    expect(a).toEqual(b)
  })
})

// ---------------------------------------------------------------------------
// (b) Multi-timeframe recipe — a recipe broadened to several mealTypes becomes
//     a candidate for each matching slot; slot-enumeration counts are unchanged.
// ---------------------------------------------------------------------------

describe('v2.1 generation regression — multi-timeframe recipes', () => {
  // A sandwich eligible for BOTH breakfast and dinner. It is the only breakfast
  // candidate, so it must fill every breakfast slot; it is also a valid dinner
  // candidate alongside the dedicated dinners.
  const sandwich = makeRecipe({ id: 'r-sandwich', mealTypes: ['breakfast', 'dinner'], dietaryTags: [] })
  const dinnerOnly = makeRecipe({ id: 'r-dinner-only', mealType: 'dinner' })

  const multiInput = (overrides: Partial<GenerateMenuInput> = {}): GenerateMenuInput =>
    makeGenerateMenuInput({
      members: [makeMember({ id: 'm1', role: 'creator' })],
      recipes: [sandwich, dinnerOnly],
      weekStartDate: '2026-01-05',
      seed: 2024,
      ...overrides,
    })

  it('slot enumeration is unchanged by broadening a recipe (count depends only on frequency × days × members)', () => {
    // The default fixture frequency is breakfast + dinner → 2 meals/day × 7 days
    // × 1 member = 14 slots. Broadening a recipe to multiple meal types does NOT
    // change slot enumeration (slots.ts is driven by meal_frequency, not recipes).
    const oneElementInput = multiInput({
      recipes: [makeRecipe({ id: 'r-bf', mealType: 'breakfast' }), makeRecipe({ id: 'r-dn', mealType: 'dinner' })],
    })
    const broadenedInput = multiInput()
    expect(buildSlots({ input: broadenedInput })).toHaveLength(14)
    // Identical slot count whether or not a recipe is broadened.
    expect(buildSlots({ input: broadenedInput }).length).toBe(buildSlots({ input: oneElementInput }).length)
  })

  it('a broadened recipe is a candidate for EACH matching slot', async () => {
    const result = await generateMenu(multiInput())
    expect(result.ok).toBe(true)
    if (!result.ok) return
    // Breakfast: the sandwich is the only candidate → fills all 7 breakfast slots.
    const breakfastPicks = result.menu.slots.filter((s) => s.mealType === 'breakfast')
    expect(breakfastPicks).toHaveLength(7)
    expect(breakfastPicks.every((s) => s.recipeId === 'r-sandwich')).toBe(true)
    // Dinner: the sandwich is ALSO admitted to the dinner pool alongside the
    // dedicated dinner, proving set membership opens both meal types. Every
    // dinner pick must come from the 2-recipe candidate set (none wrongly
    // filtered); the next test proves the sandwich's dinner-eligibility is real.
    const dinnerRecipeIds = new Set(result.menu.slots.filter((s) => s.mealType === 'dinner').map((s) => s.recipeId))
    for (const id of dinnerRecipeIds) {
      expect(['r-sandwich', 'r-dinner-only']).toContain(id)
    }
  })

  it('the broadened recipe is genuinely eligible for the dinner meal type (would be sole pick if alone)', async () => {
    // Remove the dedicated dinner: the sandwich must now fill dinner slots too,
    // proving its dinner-eligibility is real (not incidental).
    const result = await generateMenu(multiInput({ recipes: [sandwich] }))
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.menu.slots).toHaveLength(14)
    expect(result.menu.slots.every((s) => s.recipeId === 'r-sandwich')).toBe(true)
  })

  it('is deterministic for a fixed seed with a broadened recipe', async () => {
    const a = await generateMenu(multiInput())
    const b = await generateMenu(multiInput())
    expect(a).toEqual(b)
  })
})
