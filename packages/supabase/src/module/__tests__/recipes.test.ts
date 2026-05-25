import { describe, expect, it } from 'vitest'
import {
  createSupabaseMock,
  type ChainStep,
} from '@weekly-food-planner/test-utils'
import { createRecipe, updateRecipe } from '../recipes.js'

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
        meal_type: 'dinner',
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
        meal_type: 'dinner',
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
          meal_type: 'dinner',
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
