import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import {
  getWorkspaceWithMembers,
  listWorkspacesForUser,
  updateWorkspace,
} from '../workspaces.js'
import {
  createIntegrationFixture,
  INTEGRATION_ENABLED,
  type IntegrationFixture,
} from '@weekly-food-planner/test-utils'

describe.skipIf(!INTEGRATION_ENABLED)('workspaces (integration)', () => {
  let fixture: IntegrationFixture

  beforeAll(async () => {
    fixture = await createIntegrationFixture()
  })

  afterAll(async () => {
    await fixture?.cleanup()
  })

  it('signup trigger creates one individual workspace with the creator member', async () => {
    const ws = await getWorkspaceWithMembers({
      supabase: fixture.supabase,
      workspaceId: fixture.workspaceId,
    })
    expect(ws).not.toBeNull()
    expect(ws?.type).toBe('individual')
    const creators = ws?.workspace_members.filter((m) => m.role === 'creator') ?? []
    expect(creators).toHaveLength(1)
  })

  it('listWorkspacesForUser returns the auto-created workspace', async () => {
    const workspaces = await listWorkspacesForUser({
      supabase: fixture.supabase,
      userId: fixture.userId,
    })
    expect(workspaces.some((w) => w.workspace_id === fixture.workspaceId)).toBe(true)
  })

  it('updateWorkspace persists name and shared_meal_frequency', async () => {
    await updateWorkspace({
      supabase: fixture.supabase,
      workspaceId: fixture.workspaceId,
      patch: {
        name: 'Updated home',
        shared_meal_frequency: [
          { key: 'breakfast', title: 'Breakfast', mealType: 'breakfast', defaultHour: 7 },
        ],
      },
    })
    const ws = await getWorkspaceWithMembers({
      supabase: fixture.supabase,
      workspaceId: fixture.workspaceId,
    })
    expect(ws?.name).toBe('Updated home')
    expect(ws?.shared_meal_frequency).toHaveLength(1)
  })
})
