import { describe, expect, it } from 'vitest'
import { createSupabaseMock } from '@weekly-food-planner/test-utils'
import { getActiveGroceryLists } from '../grocery.js'

describe('getActiveGroceryLists', () => {
  it('returns null when no active menu exists for the workspace', async () => {
    const supabase = createSupabaseMock({
      from: {
        menus: { result: { data: null, error: null } },
      },
    })
    const result = await getActiveGroceryLists({ supabase, workspaceId: 'w1' })
    expect(result).toBeNull()
  })

  it('throws when the menus lookup errors', async () => {
    const supabase = createSupabaseMock({
      from: {
        menus: { result: { data: null, error: { message: 'db down' } } },
      },
    })
    await expect(
      getActiveGroceryLists({ supabase, workspaceId: 'w1' }),
    ).rejects.toThrow('db down')
  })

  it('joins menu → grocery_lists and returns the lists array', async () => {
    // The data layer now batches accepted menus (up to 20, ordered desc by
    // week_start_date) and picks the soonest upcoming one client-side. The
    // mock returns a single-row array; duration_days is required so the
    // upcoming/past filter has the field it needs (we set it to 1 so the
    // 2026-06-01 menu trivially counts as past, and the code falls back to
    // the most recent entry — which is still this one).
    const supabase = createSupabaseMock({
      from: {
        menus: {
          result: {
            data: [
              { id: 'menu-1', week_start_date: '2026-06-01', duration_days: 1 },
            ],
            error: null,
          },
        },
        grocery_lists: {
          result: {
            data: [{ id: 'gl-1', target_member_id: null, grocery_items: [] }],
            error: null,
          },
        },
      },
    })
    const result = await getActiveGroceryLists({ supabase, workspaceId: 'w1' })
    expect(result?.menuId).toBe('menu-1')
    expect(result?.weekStartDate).toBe('2026-06-01')
    expect(result?.lists).toHaveLength(1)
  })
})
