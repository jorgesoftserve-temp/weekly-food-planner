import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import {
  createRecipe,
  getRecipe,
  listRecipes,
  softDeleteRecipe,
  updateRecipe,
} from '../recipes.js'
import {
  createIntegrationFixture,
  INTEGRATION_ENABLED,
  type IntegrationFixture,
} from '@weekly-food-planner/test-utils'

describe.skipIf(!INTEGRATION_ENABLED)('recipes (integration)', () => {
  let fixture: IntegrationFixture

  beforeAll(async () => {
    fixture = await createIntegrationFixture()
  })

  afterAll(async () => {
    await fixture?.cleanup()
  })

  it('creates, lists, gets, updates, and soft-deletes a recipe', async () => {
    const { id: recipeId } = await createRecipe({
      supabase: fixture.supabase,
      workspaceId: fixture.workspaceId,
      payload: {
        name: 'Plain oatmeal',
        meal_types: ['breakfast'],
        difficulty: 'easy',
        servings: 1,
        cuisine: 'american',
        dietary_tags: ['vegetarian'],
      },
    })
    expect(recipeId).toMatch(/^[0-9a-f-]{36}$/)

    const list = await listRecipes({
      supabase: fixture.supabase,
      workspaceId: fixture.workspaceId,
    })
    expect(list.some((r) => r.id === recipeId)).toBe(true)

    const fetched = await getRecipe({
      supabase: fixture.supabase,
      workspaceId: fixture.workspaceId,
      recipeId,
    })
    expect(fetched?.name).toBe('Plain oatmeal')
    expect(fetched?.recipe_dietary_tags.map((t) => t.tag)).toContain('vegetarian')

    await updateRecipe({
      supabase: fixture.supabase,
      workspaceId: fixture.workspaceId,
      recipeId,
      patch: { name: 'Plain oatmeal (renamed)', calories_per_serving: 300 },
    })
    const updated = await getRecipe({
      supabase: fixture.supabase,
      workspaceId: fixture.workspaceId,
      recipeId,
    })
    expect(updated?.name).toBe('Plain oatmeal (renamed)')
    expect(updated?.calories_per_serving).toBe(300)

    await softDeleteRecipe({
      supabase: fixture.supabase,
      workspaceId: fixture.workspaceId,
      recipeId,
    })
    const afterDelete = await getRecipe({
      supabase: fixture.supabase,
      workspaceId: fixture.workspaceId,
      recipeId,
    })
    expect(afterDelete).toBeNull()
  })
})
