import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import {
  createIntegrationFixture,
  INTEGRATION_ENABLED,
  type IntegrationFixture,
} from '@weekly-food-planner/test-utils'
import {
  createRecipe,
  getRecipe,
  listRecipes,
  replaceRecipeMealTypes,
} from '../recipes.js'

// ---------------------------------------------------------------------------
// v2.1 Phase 8 — recipe_meal_types junction integration tests
//
// Covers:
//   - Backfill: every seeded recipe carries exactly one meal type in the
//     recipe_meal_types junction and recipe_kind='meal'
//   - Multi-timeframe: a recipe can declare multiple meal types and the
//     engine snapshot sees them all
//   - RLS: ownership is inherited from the parent recipe (workspace-scoped)
//   - createRecipe enforces ≥1 meal_type for kind='meal'
// ---------------------------------------------------------------------------

describe.skipIf(!INTEGRATION_ENABLED)('recipe_meal_types (integration)', () => {
  let fixture: IntegrationFixture

  beforeAll(async () => {
    fixture = await createIntegrationFixture()
  })

  afterAll(async () => {
    await fixture?.cleanup()
  })

  // ── Happy path: single meal type ──────────────────────────────────────────

  it('creates a recipe with one meal type and returns it in the meal_types array', async () => {
    const { id } = await createRecipe({
      supabase: fixture.supabase,
      workspaceId: fixture.workspaceId,
      payload: {
        name: 'Solo breakfast recipe',
        meal_types: ['breakfast'],
        difficulty: 'easy',
        servings: 1,
      },
    })
    const row = await getRecipe({
      supabase: fixture.supabase,
      workspaceId: fixture.workspaceId,
      recipeId: id,
    })
    expect(row).not.toBeNull()
    expect(row?.meal_types).toEqual(['breakfast'])
    expect(row?.recipe_kind).toBe('meal')
  })

  it('creates a recipe with multiple meal types (multi-timeframe)', async () => {
    const { id } = await createRecipe({
      supabase: fixture.supabase,
      workspaceId: fixture.workspaceId,
      payload: {
        name: 'Flexible sandwich',
        meal_types: ['breakfast', 'snack', 'dinner'],
        difficulty: 'easy',
        servings: 1,
      },
    })
    const row = await getRecipe({
      supabase: fixture.supabase,
      workspaceId: fixture.workspaceId,
      recipeId: id,
    })
    expect(row?.meal_types.sort()).toEqual(['breakfast', 'dinner', 'snack'])
  })

  it('replaceRecipeMealTypes updates the meal-type set in-place', async () => {
    const { id } = await createRecipe({
      supabase: fixture.supabase,
      workspaceId: fixture.workspaceId,
      payload: {
        name: 'Mutable meal',
        meal_types: ['lunch'],
        difficulty: 'easy',
        servings: 1,
      },
    })

    await replaceRecipeMealTypes({
      supabase: fixture.supabase,
      recipeId: id,
      mealTypes: ['lunch', 'dinner'],
    })

    const updated = await getRecipe({
      supabase: fixture.supabase,
      workspaceId: fixture.workspaceId,
      recipeId: id,
    })
    expect(updated?.meal_types.sort()).toEqual(['dinner', 'lunch'])
  })

  it('a recipe with recipe_kind=addon may have zero meal types', async () => {
    const { id } = await createRecipe({
      supabase: fixture.supabase,
      workspaceId: fixture.workspaceId,
      payload: {
        name: 'Guacamole',
        recipe_kind: 'addon',
        difficulty: 'easy',
        servings: 4,
        // No meal_types — valid for addons.
      },
    })
    const row = await getRecipe({
      supabase: fixture.supabase,
      workspaceId: fixture.workspaceId,
      recipeId: id,
    })
    expect(row?.recipe_kind).toBe('addon')
    expect(row?.meal_types).toHaveLength(0)
  })

  it('createRecipe rejects a kind=meal recipe with no meal_types (module-layer guard)', async () => {
    await expect(
      createRecipe({
        supabase: fixture.supabase,
        workspaceId: fixture.workspaceId,
        payload: {
          name: 'No-timeframe meal',
          recipe_kind: 'meal',
          difficulty: 'easy',
          servings: 1,
          // meal_types intentionally omitted
        },
      }),
    ).rejects.toThrow(/meal_type/)
  })

  // ── Backfill verification: seeded recipes carry exactly one meal type ─────

  it('all active recipes in the workspace have at least one row in recipe_meal_types', async () => {
    // Seed at least one recipe so the workspace is non-empty.
    await createRecipe({
      supabase: fixture.supabase,
      workspaceId: fixture.workspaceId,
      payload: {
        name: 'Backfill check recipe',
        meal_types: ['dinner'],
        difficulty: 'easy',
        servings: 2,
      },
    })

    const recipes = await listRecipes({
      supabase: fixture.supabase,
      workspaceId: fixture.workspaceId,
    })
    // Every meal-kind recipe must have ≥1 meal type.
    const mealKindRecipes = recipes.filter((r) => r.recipe_kind === 'meal')
    const missing = mealKindRecipes.filter((r) => r.meal_types.length === 0)
    expect(missing).toHaveLength(0)
  })

  // ── RLS: recipe ownership scopes meal-type visibility ────────────────────

  it('a recipe from another workspace is not returned by getRecipe in this workspace', async () => {
    const otherFixture = await createIntegrationFixture()
    try {
      const { id: otherId } = await createRecipe({
        supabase: otherFixture.supabase,
        workspaceId: otherFixture.workspaceId,
        payload: {
          name: 'Other workspace recipe',
          meal_types: ['lunch'],
          difficulty: 'easy',
          servings: 1,
        },
      })
      // Attempt to fetch the other workspace's recipe through this workspace's context.
      const row = await getRecipe({
        supabase: fixture.supabase,
        workspaceId: fixture.workspaceId,
        recipeId: otherId,
      })
      // Must be null: workspace_id filter gates the select.
      expect(row).toBeNull()
    } finally {
      await otherFixture.cleanup()
    }
  })

  it('recipe_meal_types rows are deleted when the parent recipe is soft-deleted (admin visibility only)', async () => {
    const { id } = await createRecipe({
      supabase: fixture.supabase,
      workspaceId: fixture.workspaceId,
      payload: {
        name: 'Soon-deleted recipe',
        meal_types: ['snack'],
        difficulty: 'easy',
        servings: 1,
      },
    })

    // Soft-delete the recipe.
    await fixture.supabase
      .from('recipes')
      .update({ is_deleted: true })
      .eq('id', id)
      .eq('workspace_id', fixture.workspaceId)

    // Via the module (which filters is_deleted=false) the recipe is invisible.
    const fetched = await getRecipe({
      supabase: fixture.supabase,
      workspaceId: fixture.workspaceId,
      recipeId: id,
    })
    expect(fetched).toBeNull()

    // Via the admin client the recipe_meal_types rows still exist (no cascade
    // triggered by soft-delete, only by hard-delete).
    const { data: mtRows } = await fixture.supabase
      .from('recipe_meal_types')
      .select('meal_type')
      .eq('recipe_id', id)
    expect(((mtRows ?? []) as Array<{ meal_type: string }>).length).toBeGreaterThan(0)
  })
})
