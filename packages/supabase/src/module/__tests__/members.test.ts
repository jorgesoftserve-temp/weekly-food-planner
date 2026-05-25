import { describe, expect, it } from 'vitest'
import {
  createSupabaseMock,
  type ChainStep,
} from '@weekly-food-planner/test-utils'
import {
  setMemberAllergies,
  setMemberDietaryRestrictions,
  setMemberIngredientDislikes,
  updateMember,
} from '../members.js'

describe('setMemberDietaryRestrictions', () => {
  it('only deletes when values is empty (no insert call)', async () => {
    const seenSteps: ChainStep[] = []
    const supabase = createSupabaseMock({
      from: {
        member_dietary_restrictions: {
          resultBySteps: (steps) => {
            seenSteps.push(...steps)
            return { data: null, error: null }
          },
        },
      },
    })
    await setMemberDietaryRestrictions({
      supabase,
      memberId: 'm1',
      values: [],
    })
    expect(seenSteps.some((s) => s.method === 'delete')).toBe(true)
    expect(seenSteps.some((s) => s.method === 'insert')).toBe(false)
  })

  it('rethrows the delete error so callers can surface it', async () => {
    const supabase = createSupabaseMock({
      from: {
        member_dietary_restrictions: {
          result: { data: null, error: { message: 'delete failed' } },
        },
      },
    })
    await expect(
      setMemberDietaryRestrictions({ supabase, memberId: 'm1', values: ['vegan'] }),
    ).rejects.toThrow('delete failed')
  })
})

describe('setMemberAllergies', () => {
  it('skips insert when values is empty', async () => {
    const inserted: ChainStep[] = []
    const supabase = createSupabaseMock({
      from: {
        member_allergies: {
          resultBySteps: (steps) => {
            if (steps[0]?.method === 'insert') inserted.push(...steps)
            return { data: null, error: null }
          },
        },
      },
    })
    await setMemberAllergies({ supabase, memberId: 'm1', values: [] })
    expect(inserted).toHaveLength(0)
  })
})

describe('setMemberIngredientDislikes', () => {
  it('skips insert when ingredientIds is empty', async () => {
    const inserted: ChainStep[] = []
    const supabase = createSupabaseMock({
      from: {
        member_ingredient_dislikes: {
          resultBySteps: (steps) => {
            if (steps[0]?.method === 'insert') inserted.push(...steps)
            return { data: null, error: null }
          },
        },
      },
    })
    await setMemberIngredientDislikes({
      supabase,
      memberId: 'm1',
      ingredientIds: [],
    })
    expect(inserted).toHaveLength(0)
  })
})

describe('updateMember', () => {
  it('rejects an empty patch object before hitting the network', async () => {
    const supabase = createSupabaseMock()
    await expect(
      updateMember({ supabase, workspaceId: 'w1', memberId: 'm1', patch: {} }),
    ).rejects.toThrow('no fields to update')
  })
})
