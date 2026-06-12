import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import {
  createIntegrationFixture,
  INTEGRATION_ENABLED,
  type IntegrationFixture,
} from '@weekly-food-planner/test-utils'
import { createRecipe, createRecipesBulk, getRecipe } from '../recipes.js'

// ---------------------------------------------------------------------------
// v2.1 Track E — bulk recipe-create integration tests
//
// Covers:
//   - Happy path: N valid recipes → N rows + all child rows + N ids returned
//   - Atomicity: a batch with one invalid payload inserts nothing (compensating
//     delete brings the count back to zero)
//   - Engine-parity: a bulk-created recipe is DB-identical to the same recipe
//     created singly (same fields, same child rows — no inputs_hash/snapshot
//     effect because recipes are ordinary catalog rows)
// ---------------------------------------------------------------------------

describe.skipIf(!INTEGRATION_ENABLED)('createRecipesBulk (Track E) (integration)', () => {
  let fixture: IntegrationFixture
  let ingredientId: string

  beforeAll(async () => {
    fixture = await createIntegrationFixture()
    const { data: ing } = await fixture.supabase
      .from('ingredients')
      .insert({ name: `BulkIng-${Date.now()}`, is_perishable: false, max_storage_days: null })
      .select('id')
      .single()
    if (!ing) throw new Error('ingredient seed failed')
    ingredientId = (ing as { id: string }).id
  })

  afterAll(async () => {
    await fixture?.cleanup()
  })

  // ── Happy path: N valid recipes ────────────────────────────────────────────

  it('inserts 3 valid recipes and returns 3 distinct ids', async () => {
    const { ids } = await createRecipesBulk({
      supabase: fixture.supabase,
      workspaceId: fixture.workspaceId,
      recipes: [
        {
          name: `Bulk recipe A ${Date.now()}`,
          meal_types: ['breakfast'],
          difficulty: 'easy',
          servings: 1,
          ingredients: [{ ingredient_id: ingredientId, quantity: 1, unit: 'cup' }],
          dietary_tags: ['vegan'],
        },
        {
          name: `Bulk recipe B ${Date.now()}`,
          meal_types: ['dinner'],
          difficulty: 'medium',
          servings: 2,
          instructions: [{ step_order: 1, description: 'Cook it', notes: 'Do not burn' }],
        },
        {
          name: `Bulk recipe C ${Date.now()}`,
          recipe_kind: 'addon',
          difficulty: 'easy',
          servings: 4,
        },
      ],
    })

    expect(ids).toHaveLength(3)
    const unique = new Set(ids)
    expect(unique.size).toBe(3)
    for (const id of ids) {
      expect(id).toMatch(/^[0-9a-f-]{36}$/)
    }
  })

  it('inserts all child rows (ingredients, instructions, dietary tags, meal types) for each recipe', async () => {
    const ts = Date.now()
    const { ids } = await createRecipesBulk({
      supabase: fixture.supabase,
      workspaceId: fixture.workspaceId,
      recipes: [
        {
          name: `ChildRow recipe ${ts}`,
          meal_types: ['lunch', 'dinner'],
          difficulty: 'easy',
          servings: 2,
          ingredients: [{ ingredient_id: ingredientId, quantity: 100, unit: 'g' }],
          instructions: [{ step_order: 1, description: 'Mix well' }],
          dietary_tags: ['vegetarian'],
        },
      ],
    })
    expect(ids).toHaveLength(1)
    const recipeId = ids[0]!

    const fetched = await getRecipe({
      supabase: fixture.supabase,
      workspaceId: fixture.workspaceId,
      recipeId,
    })
    expect(fetched).not.toBeNull()
    expect(fetched?.meal_types.sort()).toEqual(['dinner', 'lunch'])
    expect(fetched?.recipe_ingredients).toHaveLength(1)
    expect(fetched?.recipe_instructions).toHaveLength(1)
    expect(fetched?.recipe_dietary_tags.map((t) => t.tag)).toContain('vegetarian')
  })

  it('returns [] ids when called with an empty array', async () => {
    const { ids } = await createRecipesBulk({
      supabase: fixture.supabase,
      workspaceId: fixture.workspaceId,
      recipes: [],
    })
    expect(ids).toHaveLength(0)
  })

  // ── Atomicity: one invalid payload rolls the batch back ────────────────────
  //
  // The implementation validates all payloads before any write. A kind='meal'
  // recipe with no meal_types triggers the module-layer guard and throws before
  // any recipe row is inserted. We verify by counting the total recipes before
  // and after the failed call — the count must be identical.

  it('a batch containing one invalid payload (no meal_types for kind=meal) inserts nothing', async () => {
    const { data: before } = await fixture.supabase
      .from('recipes')
      .select('id', { count: 'exact', head: false })
      .eq('workspace_id', fixture.workspaceId)
      .eq('is_deleted', false)
    const countBefore = ((before ?? []) as unknown[]).length

    await expect(
      createRecipesBulk({
        supabase: fixture.supabase,
        workspaceId: fixture.workspaceId,
        recipes: [
          // Valid
          {
            name: `Good recipe ${Date.now()}`,
            meal_types: ['breakfast'],
            difficulty: 'easy',
            servings: 1,
          },
          // Invalid: no meal_types for a meal-kind recipe
          {
            name: `Bad recipe ${Date.now()}`,
            recipe_kind: 'meal',
            difficulty: 'easy',
            servings: 1,
            // meal_types intentionally absent → throws before any write
          },
        ],
      }),
    ).rejects.toThrow(/meal_type/)

    const { data: after } = await fixture.supabase
      .from('recipes')
      .select('id', { count: 'exact', head: false })
      .eq('workspace_id', fixture.workspaceId)
      .eq('is_deleted', false)
    const countAfter = ((after ?? []) as unknown[]).length

    // No net new rows.
    expect(countAfter).toBe(countBefore)
  })

  // ── Engine-parity: bulk-created == singly-created ─────────────────────────
  //
  // A recipe created via createRecipesBulk is byte-identical in the DB to the
  // same recipe created via createRecipe. We compare the core fields and child
  // rows. Neither operation touches inputs_hash or any snapshot — they are
  // ordinary catalog writes.

  it('a bulk-created recipe is DB-identical to the same recipe created singly', async () => {
    const ts = Date.now()
    const payload = {
      name: `Parity recipe ${ts}`,
      meal_types: ['dinner'] as ['dinner'],
      difficulty: 'easy' as const,
      servings: 3,
      ingredients: [{ ingredient_id: ingredientId, quantity: 150, unit: 'g' as const }],
      dietary_tags: ['vegan'],
    }

    // Create singly.
    const singly = await createRecipe({
      supabase: fixture.supabase,
      workspaceId: fixture.workspaceId,
      payload: { ...payload, name: `${payload.name} (single)` },
    })
    const singlyRow = await getRecipe({
      supabase: fixture.supabase,
      workspaceId: fixture.workspaceId,
      recipeId: singly.id,
    })

    // Create via bulk.
    const { ids: bulkIds } = await createRecipesBulk({
      supabase: fixture.supabase,
      workspaceId: fixture.workspaceId,
      recipes: [{ ...payload, name: `${payload.name} (bulk)` }],
    })
    const bulkRow = await getRecipe({
      supabase: fixture.supabase,
      workspaceId: fixture.workspaceId,
      recipeId: bulkIds[0]!,
    })

    // Assert structural parity (excluding id, name, timestamps).
    expect(bulkRow?.recipe_kind).toBe(singlyRow?.recipe_kind)
    expect(bulkRow?.difficulty).toBe(singlyRow?.difficulty)
    expect(bulkRow?.servings).toBe(singlyRow?.servings)
    expect(bulkRow?.meal_types.sort()).toEqual(singlyRow?.meal_types.sort())
    expect(bulkRow?.recipe_dietary_tags.map((t) => t.tag)).toEqual(
      singlyRow?.recipe_dietary_tags.map((t) => t.tag),
    )
    expect(bulkRow?.recipe_ingredients.map((i) => i.ingredient_id)).toEqual(
      singlyRow?.recipe_ingredients.map((i) => i.ingredient_id),
    )
    expect(bulkRow?.recipe_ingredients.map((i) => Number(i.quantity))).toEqual(
      singlyRow?.recipe_ingredients.map((i) => Number(i.quantity)),
    )
  })
})
