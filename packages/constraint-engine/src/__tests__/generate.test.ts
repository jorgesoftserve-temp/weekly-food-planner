import { describe, expect, it } from 'vitest'
import {
  makeGenerateMenuInput,
  makeRecipe,
  makeRecipeIngredient,
} from '../test-utils/index.js'
import { generateMenu } from '../generate.js'

const baseInput = makeGenerateMenuInput()

describe('generateMenu', () => {
  it('produces 14 slots for one member with 2 meals/day across 7 days', async () => {
    const result = await generateMenu(baseInput)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.menu.slots).toHaveLength(14)
  })

  it('is deterministic: same input + same seed → identical result', async () => {
    const a = await generateMenu(baseInput)
    const b = await generateMenu(baseInput)
    expect(a).toEqual(b)
  })

  it('different seeds produce different recipe assignments', async () => {
    const a = await generateMenu({ ...baseInput, seed: 1 })
    const b = await generateMenu({ ...baseInput, seed: 999 })
    if (!a.ok || !b.ok) throw new Error('Expected both to succeed')
    const aRecipes = a.menu.slots.map((s) => s.recipeId)
    const bRecipes = b.menu.slots.map((s) => s.recipeId)
    expect(aRecipes).not.toEqual(bRecipes)
  })

  it('returns no_valid_recipe when no recipes match a slot meal_type', async () => {
    const result = await generateMenu({
      ...baseInput,
      recipes: [makeRecipe({ id: 'r-snack', mealType: 'snack' })],
    })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.failedConstraint).toBe('no_valid_recipe')
  })

  it('returns NO_SLOTS error when neither workspace nor member has a meal_frequency', async () => {
    const result = await generateMenu({
      ...baseInput,
      workspace: { ...baseInput.workspace, sharedMealFrequency: undefined },
    })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.failedConstraint).toBe('internal_error')
    expect(result.error.reasonCode).toBe('NO_SLOTS')
  })

  it('returns ALL_MEALS_PASSED when frequency exists but every slot is in the past', async () => {
    const result = await generateMenu({
      ...baseInput,
      now: '2026-06-15T00:00:00', // week is 2026-06-01..06-07
    })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.reasonCode).toBe('ALL_MEALS_PASSED')
  })

  it('populates affectedMemberName alongside affectedMemberId on no_valid_recipe', async () => {
    const result = await generateMenu({
      ...baseInput,
      recipes: [makeRecipe({ id: 'r-snack', mealType: 'snack' })],
    })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.failedConstraint).toBe('no_valid_recipe')
    expect(result.error.affectedMemberId).toBeTruthy()
    expect(result.error.affectedMemberName).toBeTruthy()
  })

  it('inputsHash is a 64-char hex digest', async () => {
    const result = await generateMenu(baseInput)
    if (!result.ok) throw new Error('Expected ok')
    expect(result.inputsHash).toMatch(/^[0-9a-f]{64}$/)
  })

  it('aggregates grocery items across all assigned recipes', async () => {
    const result = await generateMenu({
      ...baseInput,
      recipes: [
        makeRecipe({
          id: 'r-bf-1',
          mealType: 'breakfast',
          ingredients: [
            makeRecipeIngredient({ ingredientId: 'i-oats', quantity: 0.5 }),
          ],
        }),
        makeRecipe({
          id: 'r-dn-1',
          mealType: 'dinner',
          ingredients: [
            makeRecipeIngredient({ ingredientId: 'i-oats', quantity: 1 }),
          ],
        }),
      ],
    })
    if (!result.ok) throw new Error('Expected ok')
    expect(result.groceryLists.shared.items).toHaveLength(1)
    const item = result.groceryLists.shared.items[0]
    if (!item) throw new Error('Expected one shared item')
    expect(item.ingredientId).toBe('i-oats')
    // 7 breakfasts × 0.5 + 7 dinners × 1 = 10.5
    expect(item.quantity).toBe(10.5)
  })
})
