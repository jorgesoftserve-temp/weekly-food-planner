import { describe, expect, it } from 'vitest'
import {
  createSupabaseMock,
  type ChainStep,
} from '@weekly-food-planner/test-utils'
import {
  createRecipe,
  replaceRecipeDietaryTags,
  replaceRecipeIngredients,
  replaceRecipeInstructions,
  updateRecipe,
} from '../recipes.js'

describe('createRecipe', () => {
  it('calls sys_save_label for cuisine before inserting the recipe', async () => {
    const rpcCalls: Array<{ name: string; args: unknown }> = []
    const insertedRecipe: ChainStep[] = []
    const supabase = createSupabaseMock({
      rpc: {
        sys_save_label: (args) => {
          rpcCalls.push({ name: 'sys_save_label', args })
          return { data: null, error: null }
        },
      },
      from: {
        recipes: {
          resultBySteps: (steps) => {
            insertedRecipe.push(...steps)
            return { data: { id: 'r-1' }, error: null }
          },
        },
      },
    })
    const result = await createRecipe({
      supabase,
      workspaceId: 'w1',
      payload: {
        name: 'Pasta',
        meal_types: ['dinner'],
        difficulty: 'easy',
        servings: 2,
        cuisine: 'italian',
      },
    })
    expect(result.id).toBe('r-1')
    expect(rpcCalls).toHaveLength(1)
    expect(rpcCalls[0]?.args).toEqual({
      p_enum_type: 'cuisine_type',
      p_value: 'italian',
    })
  })

  it('calls sys_save_label once per dietary_tag', async () => {
    const rpcCalls: unknown[] = []
    const supabase = createSupabaseMock({
      rpc: {
        sys_save_label: (args) => {
          rpcCalls.push(args)
          return { data: null, error: null }
        },
      },
      from: {
        recipes: { result: { data: { id: 'r-1' }, error: null } },
        recipe_dietary_tags: { result: { data: null, error: null } },
      },
    })
    await createRecipe({
      supabase,
      workspaceId: 'w1',
      payload: {
        name: 'Pasta',
        meal_types: ['dinner'],
        difficulty: 'easy',
        servings: 2,
        dietary_tags: ['vegetarian', 'low_sodium'],
      },
    })
    expect(rpcCalls).toHaveLength(2)
  })

  it('surfaces the insert error from supabase', async () => {
    const supabase = createSupabaseMock({
      from: {
        recipes: { result: { data: null, error: { message: 'fk violation' } } },
      },
    })
    await expect(
      createRecipe({
        supabase,
        workspaceId: 'w1',
        payload: {
          name: 'Pasta',
          meal_types: ['dinner'],
          difficulty: 'easy',
          servings: 2,
        },
      }),
    ).rejects.toThrow('fk violation')
  })
})

describe('updateRecipe', () => {
  it('rejects empty patch up front', async () => {
    const supabase = createSupabaseMock()
    await expect(
      updateRecipe({ supabase, workspaceId: 'w1', recipeId: 'r-1', patch: {} }),
    ).rejects.toThrow('no fields to update')
  })
})

describe('replaceRecipeIngredients', () => {
  it('deletes then inserts; skips insert when the new array is empty', async () => {
    const seenSteps: ChainStep[] = []
    const supabase = createSupabaseMock({
      from: {
        recipe_ingredients: {
          resultBySteps: (steps) => {
            seenSteps.push(...steps)
            return { data: null, error: null }
          },
        },
      },
    })
    await replaceRecipeIngredients({
      supabase,
      recipeId: 'r-1',
      ingredients: [],
    })
    // Only the delete chain runs when the new list is empty.
    expect(seenSteps.some((s) => s.method === 'delete')).toBe(true)
    expect(seenSteps.some((s) => s.method === 'insert')).toBe(false)
  })

  it('runs delete + insert when ingredients are provided', async () => {
    const inserted: ChainStep[] = []
    const supabase = createSupabaseMock({
      from: {
        recipe_ingredients: {
          resultBySteps: (steps) => {
            inserted.push(...steps)
            return { data: null, error: null }
          },
        },
      },
    })
    await replaceRecipeIngredients({
      supabase,
      recipeId: 'r-1',
      ingredients: [
        { ingredient_id: 'i-oats', quantity: 0.5, unit: 'cup' },
        { ingredient_id: 'i-milk', quantity: 1, unit: 'cup' },
      ],
    })
    expect(inserted.some((s) => s.method === 'delete')).toBe(true)
    expect(inserted.some((s) => s.method === 'insert')).toBe(true)
  })

  it('surfaces a delete error from supabase', async () => {
    let callCount = 0
    const supabase = createSupabaseMock({
      from: {
        recipe_ingredients: {
          resultBySteps: () => {
            callCount += 1
            return callCount === 1
              ? { data: null, error: { message: 'delete failed' } }
              : { data: null, error: null }
          },
        },
      },
    })
    await expect(
      replaceRecipeIngredients({
        supabase,
        recipeId: 'r-1',
        ingredients: [],
      }),
    ).rejects.toThrow('delete failed')
  })
})

describe('replaceRecipeInstructions', () => {
  it('runs delete + insert for non-empty arrays', async () => {
    const seen: ChainStep[] = []
    const supabase = createSupabaseMock({
      from: {
        recipe_instructions: {
          resultBySteps: (steps) => {
            seen.push(...steps)
            return { data: null, error: null }
          },
        },
      },
    })
    await replaceRecipeInstructions({
      supabase,
      recipeId: 'r-1',
      instructions: [
        { step_order: 1, description: 'Boil water' },
        { step_order: 2, description: 'Add pasta' },
      ],
    })
    expect(seen.some((s) => s.method === 'delete')).toBe(true)
    expect(seen.some((s) => s.method === 'insert')).toBe(true)
  })

  it('skips insert when instructions are empty', async () => {
    const seen: ChainStep[] = []
    const supabase = createSupabaseMock({
      from: {
        recipe_instructions: {
          resultBySteps: (steps) => {
            seen.push(...steps)
            return { data: null, error: null }
          },
        },
      },
    })
    await replaceRecipeInstructions({
      supabase,
      recipeId: 'r-1',
      instructions: [],
    })
    expect(seen.some((s) => s.method === 'insert')).toBe(false)
  })
})

describe('replaceRecipeDietaryTags', () => {
  it('calls sys_save_label once per tag before delete+insert', async () => {
    const rpcCalls: unknown[] = []
    const supabase = createSupabaseMock({
      rpc: {
        sys_save_label: (args) => {
          rpcCalls.push(args)
          return { data: null, error: null }
        },
      },
      from: {
        recipe_dietary_tags: { result: { data: null, error: null } },
      },
    })
    await replaceRecipeDietaryTags({
      supabase,
      recipeId: 'r-1',
      tags: ['vegetarian', 'low_sodium'],
    })
    expect(rpcCalls).toHaveLength(2)
    expect(rpcCalls[0]).toEqual({
      p_enum_type: 'dietary_tag',
      p_value: 'vegetarian',
    })
  })

  it('skips insert when the new tag list is empty (delete still runs)', async () => {
    const seen: ChainStep[] = []
    const supabase = createSupabaseMock({
      rpc: {
        sys_save_label: () => ({ data: null, error: null }),
      },
      from: {
        recipe_dietary_tags: {
          resultBySteps: (steps) => {
            seen.push(...steps)
            return { data: null, error: null }
          },
        },
      },
    })
    await replaceRecipeDietaryTags({
      supabase,
      recipeId: 'r-1',
      tags: [],
    })
    expect(seen.some((s) => s.method === 'delete')).toBe(true)
    expect(seen.some((s) => s.method === 'insert')).toBe(false)
  })
})
