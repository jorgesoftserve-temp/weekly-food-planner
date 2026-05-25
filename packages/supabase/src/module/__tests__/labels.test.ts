import { describe, expect, it } from 'vitest'
import {
  createSupabaseMock,
  type ChainStep,
} from '@weekly-food-planner/test-utils'
import { saveLabel, searchLabels } from '../labels.js'

describe('searchLabels', () => {
  it('does not apply ilike when query is empty', async () => {
    const seenSteps: ChainStep[] = []
    const supabase = createSupabaseMock({
      from: {
        enum_metadata: {
          resultBySteps: (steps) => {
            seenSteps.push(...steps)
            return { data: [], error: null }
          },
        },
      },
    })
    await searchLabels({ supabase, enumType: 'dietary_tag', query: '   ' })
    expect(seenSteps.some((s) => s.method === 'ilike')).toBe(false)
  })

  it('applies ilike with %-wrapped term when query is non-empty', async () => {
    const seenSteps: ChainStep[] = []
    const supabase = createSupabaseMock({
      from: {
        enum_metadata: {
          resultBySteps: (steps) => {
            seenSteps.push(...steps)
            return { data: [], error: null }
          },
        },
      },
    })
    await searchLabels({ supabase, enumType: 'dietary_tag', query: 'veg' })
    const ilike = seenSteps.find((s) => s.method === 'ilike')
    expect(ilike).toBeDefined()
    expect(ilike?.args[1]).toBe('%veg%')
  })

  it('throws when the query errors', async () => {
    const supabase = createSupabaseMock({
      from: {
        enum_metadata: {
          result: { data: null, error: { message: 'boom' } },
        },
      },
    })
    await expect(
      searchLabels({ supabase, enumType: 'dietary_tag', query: '' }),
    ).rejects.toThrow('boom')
  })
})

describe('saveLabel', () => {
  it('throws when the rpc errors', async () => {
    const supabase = createSupabaseMock({
      rpc: {
        sys_save_label: { data: null, error: { message: 'rpc failed' } },
      },
    })
    await expect(
      saveLabel({ supabase, enumType: 'dietary_tag', value: 'vegan' }),
    ).rejects.toThrow('rpc failed')
  })

  it('resolves cleanly on success', async () => {
    const supabase = createSupabaseMock({
      rpc: { sys_save_label: { data: null, error: null } },
    })
    await expect(
      saveLabel({ supabase, enumType: 'dietary_tag', value: 'vegan' }),
    ).resolves.toBeUndefined()
  })
})
