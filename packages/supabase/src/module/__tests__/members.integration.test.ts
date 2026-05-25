import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import {
  createMember,
  getMember,
  listMembers,
  setMemberAllergies,
  setMemberDietaryRestrictions,
  softDeleteMember,
  updateMember,
} from '../members.js'
import {
  createIntegrationFixture,
  INTEGRATION_ENABLED,
  type IntegrationFixture,
} from '@weekly-food-planner/test-utils'

describe.skipIf(!INTEGRATION_ENABLED)('members (integration)', () => {
  let fixture: IntegrationFixture

  beforeAll(async () => {
    fixture = await createIntegrationFixture()
  })

  afterAll(async () => {
    await fixture?.cleanup()
  })

  it('creates a member, lists it, gets it, updates it, and soft-deletes it', async () => {
    const { id: memberId } = await createMember({
      supabase: fixture.supabase,
      workspaceId: fixture.workspaceId,
      payload: {
        name: 'Test Kid',
        role: 'member',
        age_category: 'child',
        daily_calorie_target: 1500,
        dietary_restrictions: ['vegetarian'],
        allergies: ['peanut'],
      },
    })
    expect(memberId).toMatch(/^[0-9a-f-]{36}$/)

    const all = await listMembers({
      supabase: fixture.supabase,
      workspaceId: fixture.workspaceId,
    })
    expect(all.some((m) => m.id === memberId)).toBe(true)

    const fetched = await getMember({
      supabase: fixture.supabase,
      workspaceId: fixture.workspaceId,
      memberId,
    })
    expect(fetched?.name).toBe('Test Kid')
    expect(fetched?.member_dietary_restrictions.map((r) => r.restriction)).toContain('vegetarian')
    expect(fetched?.member_allergies.map((a) => a.allergy)).toContain('peanut')

    await updateMember({
      supabase: fixture.supabase,
      workspaceId: fixture.workspaceId,
      memberId,
      patch: { daily_calorie_target: 1600 },
    })
    const updated = await getMember({
      supabase: fixture.supabase,
      workspaceId: fixture.workspaceId,
      memberId,
    })
    expect(updated?.daily_calorie_target).toBe(1600)

    await setMemberDietaryRestrictions({
      supabase: fixture.supabase,
      memberId,
      values: ['vegan'],
    })
    const afterRestrictions = await getMember({
      supabase: fixture.supabase,
      workspaceId: fixture.workspaceId,
      memberId,
    })
    expect(afterRestrictions?.member_dietary_restrictions.map((r) => r.restriction)).toEqual(['vegan'])

    await setMemberAllergies({ supabase: fixture.supabase, memberId, values: [] })
    const afterAllergies = await getMember({
      supabase: fixture.supabase,
      workspaceId: fixture.workspaceId,
      memberId,
    })
    expect(afterAllergies?.member_allergies).toHaveLength(0)

    await softDeleteMember({
      supabase: fixture.supabase,
      workspaceId: fixture.workspaceId,
      memberId,
    })
    const afterDelete = await getMember({
      supabase: fixture.supabase,
      workspaceId: fixture.workspaceId,
      memberId,
    })
    expect(afterDelete).toBeNull()
  })
})
