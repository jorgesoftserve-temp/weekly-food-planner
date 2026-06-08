import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  makeIngredient,
  makeMember,
  makeRecipe,
  makeWorkspace,
} from '@weekly-food-planner/test-utils'
import type { SupabaseClient } from '@supabase/supabase-js'
import { buildWeeklyEngineInput } from '../menu-input-builder'
import type { LoadSnapshotResult } from '../menu-loader'

vi.mock('../menu-loader', () => ({
  loadEngineSnapshot: vi.fn(),
}))

const loaderModule = await import('../menu-loader')
const loadEngineSnapshot = loaderModule.loadEngineSnapshot as unknown as ReturnType<
  typeof vi.fn
>

const FAKE_SUPABASE = {} as unknown as SupabaseClient

const NOW_ISO = '2026-05-28T12:00:00.000Z'

const okSnapshot = (overrides?: Partial<Extract<LoadSnapshotResult, { ok: true }>>) => {
  const base: Extract<LoadSnapshotResult, { ok: true }> = {
    ok: true,
    workspace: makeWorkspace({ id: 'ws-1', name: 'House' }),
    members: [
      makeMember({ id: 'm1', name: 'Alice' }),
      makeMember({ id: 'm2', name: 'Bob' }),
    ],
    recipes: [makeRecipe({ id: 'r1', name: 'Toast' })],
    ingredients: [makeIngredient({ id: 'i1', name: 'Bread' })],
  }
  return { ...base, ...overrides }
}

describe('buildWeeklyEngineInput', () => {
  beforeEach(() => {
    loadEngineSnapshot.mockReset()
  })

  it('returns 404 when the workspace does not exist', async () => {
    loadEngineSnapshot.mockResolvedValueOnce({
      ok: false,
      reason: 'workspace_not_found',
    })
    const result = await buildWeeklyEngineInput({
      supabase: FAKE_SUPABASE,
      workspaceId: 'ws-1',
      body: { weekStartDate: '2026-06-01' },
      nowIso: NOW_ISO,
    })
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.status).toBe(404)
      expect(result.code).toBe('not_found')
    }
  })

  it('returns 412 with empty_workspace when the workspace has no recipes', async () => {
    loadEngineSnapshot.mockResolvedValueOnce({ ok: false, reason: 'no_recipes' })
    const result = await buildWeeklyEngineInput({
      supabase: FAKE_SUPABASE,
      workspaceId: 'ws-1',
      body: { weekStartDate: '2026-06-01' },
      nowIso: NOW_ISO,
    })
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.status).toBe(412)
      expect(result.code).toBe('empty_workspace')
    }
  })

  it('returns 500 when the snapshot loader reports a db_error', async () => {
    loadEngineSnapshot.mockResolvedValueOnce({
      ok: false,
      reason: 'db_error',
      detail: 'connection refused',
    })
    const result = await buildWeeklyEngineInput({
      supabase: FAKE_SUPABASE,
      workspaceId: 'ws-1',
      body: { weekStartDate: '2026-06-01' },
      nowIso: NOW_ISO,
    })
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.status).toBe(500)
      expect(result.code).toBe('snapshot_load_failed')
      expect(result.detail).toContain('connection refused')
    }
  })

  it('defaults participantMemberIds to every active member when omitted', async () => {
    loadEngineSnapshot.mockResolvedValueOnce(okSnapshot())
    const result = await buildWeeklyEngineInput({
      supabase: FAKE_SUPABASE,
      workspaceId: 'ws-1',
      body: { weekStartDate: '2026-06-01', seed: 42 },
      nowIso: NOW_ISO,
    })
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.participantMemberIds.sort()).toEqual(['m1', 'm2'])
      expect(result.input.members.map((m) => m.id).sort()).toEqual(['m1', 'm2'])
    }
  })

  it('rejects an empty participantMemberIds array with 400', async () => {
    loadEngineSnapshot.mockResolvedValueOnce(okSnapshot())
    const result = await buildWeeklyEngineInput({
      supabase: FAKE_SUPABASE,
      workspaceId: 'ws-1',
      body: { weekStartDate: '2026-06-01', participantMemberIds: [] },
      nowIso: NOW_ISO,
    })
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.status).toBe(400)
      expect(result.code).toBe('invalid_participants')
    }
  })

  it('filters requested participantMemberIds down to known workspace members', async () => {
    loadEngineSnapshot.mockResolvedValueOnce(okSnapshot())
    const result = await buildWeeklyEngineInput({
      supabase: FAKE_SUPABASE,
      workspaceId: 'ws-1',
      body: {
        weekStartDate: '2026-06-01',
        participantMemberIds: ['m1', 'not-a-member'],
      },
      nowIso: NOW_ISO,
    })
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.participantMemberIds).toEqual(['m1'])
      expect(result.input.members.map((m) => m.id)).toEqual(['m1'])
    }
  })

  it('returns 400 when every requested participant is unknown to the workspace', async () => {
    loadEngineSnapshot.mockResolvedValueOnce(okSnapshot())
    const result = await buildWeeklyEngineInput({
      supabase: FAKE_SUPABASE,
      workspaceId: 'ws-1',
      body: {
        weekStartDate: '2026-06-01',
        participantMemberIds: ['nope-1', 'nope-2'],
      },
      nowIso: NOW_ISO,
    })
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.status).toBe(400)
      expect(result.code).toBe('invalid_participants')
    }
  })

  it('threads the dedup-aware effective overlay onto input.options', async () => {
    loadEngineSnapshot.mockResolvedValueOnce(
      okSnapshot({
        members: [
          makeMember({ id: 'm1', dietaryRestrictions: ['vegan'] }),
          makeMember({ id: 'm2' }),
        ],
      }),
    )
    const result = await buildWeeklyEngineInput({
      supabase: FAKE_SUPABASE,
      workspaceId: 'ws-1',
      body: {
        weekStartDate: '2026-06-01',
        options: { additionalDietaryRestrictions: ['vegan', 'gluten_free'] },
      },
      nowIso: NOW_ISO,
    })
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.effectiveOverlay?.additionalDietaryRestrictions).toEqual([
        'gluten_free',
      ])
      expect(result.input.options).toBe(result.effectiveOverlay)
    }
  })

  it('uses the provided seed verbatim when supplied', async () => {
    loadEngineSnapshot.mockResolvedValueOnce(okSnapshot())
    const result = await buildWeeklyEngineInput({
      supabase: FAKE_SUPABASE,
      workspaceId: 'ws-1',
      body: { weekStartDate: '2026-06-01', seed: 12345 },
      nowIso: NOW_ISO,
    })
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.seed).toBe(12345)
      expect(result.input.seed).toBe(12345)
    }
  })

  it('generates a deterministic non-negative seed when none is supplied', async () => {
    loadEngineSnapshot.mockResolvedValueOnce(okSnapshot())
    const result = await buildWeeklyEngineInput({
      supabase: FAKE_SUPABASE,
      workspaceId: 'ws-1',
      body: { weekStartDate: '2026-06-01' },
      nowIso: NOW_ISO,
    })
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.seed).toBeGreaterThanOrEqual(0)
      expect(result.seed).toBeLessThanOrEqual(2_147_483_647)
      expect(Number.isInteger(result.seed)).toBe(true)
    }
  })

  it('clamps durationDays into [1, 7] and defaults missing/invalid values to 7', async () => {
    loadEngineSnapshot.mockResolvedValue(okSnapshot())
    const cases: Array<[number | undefined, number]> = [
      [undefined, 7],
      [0, 1],
      [-5, 1],
      [3, 3],
      [9, 7],
      [Number.NaN, 7],
    ]
    for (const [input, expected] of cases) {
      const result = await buildWeeklyEngineInput({
        supabase: FAKE_SUPABASE,
        workspaceId: 'ws-1',
        body: { weekStartDate: '2026-06-01', durationDays: input },
        nowIso: NOW_ISO,
      })
      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.durationDays).toBe(expected)
        expect(result.input.durationDays).toBe(expected)
      }
    }
  })

  it('threads nowIso through to input.now without mutating it', async () => {
    loadEngineSnapshot.mockResolvedValueOnce(okSnapshot())
    const result = await buildWeeklyEngineInput({
      supabase: FAKE_SUPABASE,
      workspaceId: 'ws-1',
      body: { weekStartDate: '2026-06-01' },
      nowIso: NOW_ISO,
    })
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.input.now).toBe(NOW_ISO)
    }
  })
})
