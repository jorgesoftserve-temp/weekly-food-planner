import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import {
  getSlotCompletionsForMenu,
  upsertSlotCompletion,
  updateSlotCompletion,
} from '../slot-completions.js'
import {
  createIntegrationFixture,
  INTEGRATION_ENABLED,
  type IntegrationFixture,
} from '@weekly-food-planner/test-utils'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Create a user-scoped Supabase client (bypasses service-role, fires RLS).
 * Signs in with email/password credentials created via the admin API.
 */
const createUserClient = async ({
  email,
  password,
}: {
  email: string
  password: string
}): Promise<SupabaseClient> => {
  const url = process.env.SUPABASE_TEST_URL!
  const anonKey = process.env.SUPABASE_TEST_ANON_KEY ?? process.env.SUPABASE_TEST_SERVICE_KEY!
  const client = createClient(url, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  const { error } = await client.auth.signInWithPassword({ email, password })
  if (error) throw new Error(`signInWithPassword failed: ${error.message}`)
  return client
}

const TEST_PASSWORD = 'test-password-1234'

const randomEmail = (): string =>
  `wfp-slot-cmp-test-${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.test`

// ---------------------------------------------------------------------------
// Seed helpers (service-role only — schema-dependent rows)
// ---------------------------------------------------------------------------

type SeedState = {
  menuId: string
  menuSlotId: string
  creatorMemberId: string
  recipeId: string
}

/**
 * Seeds the minimal DB state needed to test slot_completions:
 *   recipe → accepted menu → menu_slot
 *
 * All inserts use the service-role client so RLS does not interfere with
 * setup; the tests themselves use user-scoped clients where relevant.
 */
const seedCompletionFixture = async ({
  supabase,
  workspaceId,
  userId,
}: {
  supabase: SupabaseClient
  workspaceId: string
  userId: string
}): Promise<SeedState> => {
  // 1. Resolve the creator's workspace_members row created by the signup trigger.
  const { data: member, error: memErr } = await supabase
    .from('workspace_members')
    .select('id')
    .eq('workspace_id', workspaceId)
    .eq('user_id', userId)
    .eq('is_deleted', false)
    .maybeSingle()
  if (memErr || !member) {
    throw new Error(`creator member row not found: ${memErr?.message ?? 'no row'}`)
  }
  const creatorMemberId = (member as { id: string }).id

  // 2. Seed a recipe in the workspace (service-role bypasses RLS).
  const { data: recipe, error: recipeErr } = await supabase
    .from('recipes')
    .insert({
      workspace_id: workspaceId,
      name: `Test Recipe ${Date.now()}`,
      recipe_kind: 'meal',
      difficulty: 'easy',
      servings: 4,
      is_deleted: false,
    })
    .select('id')
    .single()
  if (recipeErr || !recipe) throw new Error(`recipe seed failed: ${recipeErr?.message ?? 'no row'}`)
  const recipeId = (recipe as { id: string }).id
  // (v2.1) recipe_meal_types replaces the dropped scalar meal_type column.
  await supabase.from('recipe_meal_types').insert({ recipe_id: recipeId, meal_type: 'dinner' })

  // 3. Insert an accepted menu (accepted_at non-null → accepted state).
  const { data: menu, error: menuErr } = await supabase
    .from('menus')
    .insert({
      workspace_id: workspaceId,
      week_start_date: '2099-03-10',
      seed: 7,
      inputs_hash: `slot-cmp-hash-${Date.now()}`,
      generation_options: {},
      accepted_at: new Date().toISOString(),
      accepted_seed: '7',
      is_deleted: false,
      duration_days: 7,
    })
    .select('id')
    .single()
  if (menuErr || !menu) throw new Error(`menu seed failed: ${menuErr?.message ?? 'no row'}`)
  const menuId = (menu as { id: string }).id

  // 4. Insert a menu_slot that references the recipe.
  const { data: slot, error: slotErr } = await supabase
    .from('menu_slots')
    .insert({
      menu_id: menuId,
      day_of_week: 'monday',
      meal_key: 'dinner_monday',
      meal_type: 'dinner',
      recipe_id: recipeId,
      target_member_id: null,
    })
    .select('id')
    .single()
  if (slotErr || !slot) throw new Error(`menu_slot seed failed: ${slotErr?.message ?? 'no row'}`)
  const menuSlotId = (slot as { id: string }).id

  return { menuId, menuSlotId, creatorMemberId, recipeId }
}

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

describe.skipIf(!INTEGRATION_ENABLED)('slot-completions (integration)', () => {
  let fixture: IntegrationFixture
  let seed: SeedState

  beforeAll(async () => {
    fixture = await createIntegrationFixture()
    seed = await seedCompletionFixture({
      supabase: fixture.supabase,
      workspaceId: fixture.workspaceId,
      userId: fixture.userId,
    })
  })

  afterAll(async () => {
    // Service-role cleanup — cascade deletes handle slot_completions automatically.
    if (seed?.menuId) {
      await fixture?.supabase.from('menus').delete().eq('id', seed.menuId)
    }
    if (seed?.recipeId) {
      await fixture?.supabase.from('recipes').delete().eq('id', seed.recipeId)
    }
    await fixture?.cleanup()
  })

  // -------------------------------------------------------------------------
  // 1. Happy path: upsert creates a completion row (status=cooked, cooked_at set)
  // -------------------------------------------------------------------------
  it('upserts a completion for a slot (status cooked, cooked_at set) and getSlotCompletionsForMenu returns it', async () => {
    // Arrange
    const cookedAt = new Date().toISOString()

    // Act
    const row = await upsertSlotCompletion({
      supabase: fixture.supabase,
      payload: {
        menu_slot_id: seed.menuSlotId,
        workspace_id: fixture.workspaceId,
        status: 'cooked',
        cooked_at: cookedAt,
        created_by: seed.creatorMemberId,
      },
    })

    // Assert — row created
    expect(row.id).toMatch(/^[0-9a-f-]{36}$/)
    expect(row.menu_slot_id).toBe(seed.menuSlotId)
    expect(row.workspace_id).toBe(fixture.workspaceId)
    expect(row.status).toBe('cooked')
    expect(row.cooked_at).toBeTruthy()

    // Assert — getSlotCompletionsForMenu returns the row keyed to this menu
    const completions = await getSlotCompletionsForMenu({
      supabase: fixture.supabase,
      menuId: seed.menuId,
    })
    expect(completions.length).toBe(1)
    expect(completions[0]!.menu_slot_id).toBe(seed.menuSlotId)
    expect(completions[0]!.status).toBe('cooked')
    // The join helper (menu_slot) must be stripped from the returned shape
    expect((completions[0] as Record<string, unknown>)['menu_slot']).toBeUndefined()
  })

  // -------------------------------------------------------------------------
  // 2. Idempotent upsert: same menu_slot_id flips status in place → still one row
  // -------------------------------------------------------------------------
  it('upserting again for the same menu_slot_id updates in place (unique constraint, still one row, status skipped)', async () => {
    // Act — upsert the same slot with status='skipped'
    const row = await upsertSlotCompletion({
      supabase: fixture.supabase,
      payload: {
        menu_slot_id: seed.menuSlotId,
        workspace_id: fixture.workspaceId,
        status: 'skipped',
        created_by: seed.creatorMemberId,
      },
    })

    // Assert — same menu_slot_id, status updated
    expect(row.menu_slot_id).toBe(seed.menuSlotId)
    expect(row.status).toBe('skipped')

    // Assert — still exactly one completion row for this menu
    const completions = await getSlotCompletionsForMenu({
      supabase: fixture.supabase,
      menuId: seed.menuId,
    })
    expect(completions.length).toBe(1)
    expect(completions[0]!.status).toBe('skipped')
  })

  // -------------------------------------------------------------------------
  // 3. Absent completion: a slot with no row simply does not appear in results
  // -------------------------------------------------------------------------
  it('a slot with no completion row does not appear in getSlotCompletionsForMenu results', async () => {
    // Arrange — insert a second slot with no completion row
    const { data: slot2, error: slot2Err } = await fixture.supabase
      .from('menu_slots')
      .insert({
        menu_id: seed.menuId,
        day_of_week: 'tuesday',
        meal_key: 'dinner_tuesday',
        meal_type: 'dinner',
        recipe_id: seed.recipeId,
        target_member_id: null,
      })
      .select('id')
      .single()
    if (slot2Err || !slot2) throw new Error(`second slot seed failed: ${slot2Err?.message ?? 'no row'}`)
    const slot2Id = (slot2 as { id: string }).id

    try {
      // Act
      const completions = await getSlotCompletionsForMenu({
        supabase: fixture.supabase,
        menuId: seed.menuId,
      })

      // Assert — slot2 has no row; should not appear
      const foundForSlot2 = completions.find((c) => c.menu_slot_id === slot2Id)
      expect(foundForSlot2).toBeUndefined()
    } finally {
      await fixture.supabase.from('menu_slots').delete().eq('id', slot2Id)
    }
  })

  // -------------------------------------------------------------------------
  // 4. updateSlotCompletion patches notes without changing status
  // -------------------------------------------------------------------------
  it('updateSlotCompletion patches notes without changing the status field', async () => {
    // Arrange — ensure there is a completion row (status from test 2 above is 'skipped')
    const before = await getSlotCompletionsForMenu({
      supabase: fixture.supabase,
      menuId: seed.menuId,
    })
    const beforeRow = before.find((c) => c.menu_slot_id === seed.menuSlotId)
    expect(beforeRow).toBeDefined()
    const statusBefore = beforeRow!.status

    // Act — patch only notes
    await updateSlotCompletion({
      supabase: fixture.supabase,
      menuSlotId: seed.menuSlotId,
      patch: { notes: 'swapped in leftovers' },
    })

    // Assert — notes updated, status unchanged
    const after = await getSlotCompletionsForMenu({
      supabase: fixture.supabase,
      menuId: seed.menuId,
    })
    const afterRow = after.find((c) => c.menu_slot_id === seed.menuSlotId)
    expect(afterRow).toBeDefined()
    expect(afterRow!.notes).toBe('swapped in leftovers')
    expect(afterRow!.status).toBe(statusBefore)
  })

  // -------------------------------------------------------------------------
  // 5. RLS read: non-member gets an empty set (not an error)
  // -------------------------------------------------------------------------
  it('denies a non-member from reading slot completions — RLS returns empty set, not an error', async () => {
    // Arrange — create a user who has no membership in fixture.workspaceId.
    const outsiderEmail = randomEmail()
    const { data: outsiderUser, error: outsiderErr } = await fixture.supabase.auth.admin.createUser({
      email: outsiderEmail,
      password: TEST_PASSWORD,
      email_confirm: true,
    })
    if (outsiderErr || !outsiderUser.user) {
      throw new Error(`outsider user creation failed: ${outsiderErr?.message ?? 'no user'}`)
    }
    const outsiderUserId = outsiderUser.user.id

    try {
      const outsiderClient = await createUserClient({ email: outsiderEmail, password: TEST_PASSWORD })

      // Act — outsider calls the module function with the fixture's menuId
      const completions = await getSlotCompletionsForMenu({
        supabase: outsiderClient,
        menuId: seed.menuId,
      })

      // Assert — RLS returns empty set; function must not throw
      expect(completions).toHaveLength(0)
    } finally {
      await fixture.supabase.auth.admin.deleteUser(outsiderUserId)
    }
  })

  // -------------------------------------------------------------------------
  // 6. RLS write: non-member's upsert is denied (WITH CHECK blocks the INSERT)
  // -------------------------------------------------------------------------
  it('denies a non-member from upserting a slot completion (RLS write policy, code 42501)', async () => {
    // Arrange — outsider user with no workspace membership
    const outsiderEmail = randomEmail()
    const { data: outsiderUser, error: outsiderErr } = await fixture.supabase.auth.admin.createUser({
      email: outsiderEmail,
      password: TEST_PASSWORD,
      email_confirm: true,
    })
    if (outsiderErr || !outsiderUser.user) {
      throw new Error(`outsider user creation failed: ${outsiderErr?.message ?? 'no user'}`)
    }
    const outsiderUserId = outsiderUser.user.id

    try {
      const outsiderClient = await createUserClient({ email: outsiderEmail, password: TEST_PASSWORD })

      // Act — outsider tries to insert a completion directly (bypassing the module
      // to inspect the raw PostgREST error code)
      const { error } = await outsiderClient.from('slot_completions').insert({
        menu_slot_id: seed.menuSlotId,
        workspace_id: fixture.workspaceId,
        status: 'cooked',
      })

      // Assert — RLS WITH CHECK blocks the insert; PostgREST returns 42501
      expect(error).not.toBeNull()
      expect(error?.code).toBe('42501')
    } finally {
      await fixture.supabase.auth.admin.deleteUser(outsiderUserId)
    }
  })

  // -------------------------------------------------------------------------
  // 7. Menu isolation: getSlotCompletionsForMenu only returns completions for
  //    the queried menu, not for completions belonging to a different menu
  // -------------------------------------------------------------------------
  it('getSlotCompletionsForMenu only returns completions for the queried menu (cross-menu isolation)', async () => {
    // Arrange — create a second menu with its own slot and completion row
    const { data: menu2, error: menu2Err } = await fixture.supabase
      .from('menus')
      .insert({
        workspace_id: fixture.workspaceId,
        week_start_date: '2099-04-07',
        seed: 13,
        inputs_hash: `slot-cmp-isolation-${Date.now()}`,
        generation_options: {},
        accepted_at: new Date().toISOString(),
        accepted_seed: '13',
        is_deleted: false,
        duration_days: 7,
      })
      .select('id')
      .single()
    if (menu2Err || !menu2) throw new Error(`menu2 seed failed: ${menu2Err?.message ?? 'no row'}`)
    const menu2Id = (menu2 as { id: string }).id

    const { data: slot2, error: slot2Err } = await fixture.supabase
      .from('menu_slots')
      .insert({
        menu_id: menu2Id,
        day_of_week: 'wednesday',
        meal_key: 'dinner_wednesday',
        meal_type: 'dinner',
        recipe_id: seed.recipeId,
        target_member_id: null,
      })
      .select('id')
      .single()
    if (slot2Err || !slot2) throw new Error(`slot2 seed failed: ${slot2Err?.message ?? 'no row'}`)
    const slot2Id = (slot2 as { id: string }).id

    // Upsert a completion for the second menu's slot
    await upsertSlotCompletion({
      supabase: fixture.supabase,
      payload: {
        menu_slot_id: slot2Id,
        workspace_id: fixture.workspaceId,
        status: 'cooked',
        created_by: seed.creatorMemberId,
      },
    })

    try {
      // Act — query completions for the ORIGINAL menu only
      const completionsForMenu1 = await getSlotCompletionsForMenu({
        supabase: fixture.supabase,
        menuId: seed.menuId,
      })

      // Act — query completions for the SECOND menu only
      const completionsForMenu2 = await getSlotCompletionsForMenu({
        supabase: fixture.supabase,
        menuId: menu2Id,
      })

      // Assert — menu1 results contain only its own slot, not slot2
      const menu1SlotIds = completionsForMenu1.map((c) => c.menu_slot_id)
      expect(menu1SlotIds).toContain(seed.menuSlotId)
      expect(menu1SlotIds).not.toContain(slot2Id)

      // Assert — menu2 results contain only slot2, not the original slot
      const menu2SlotIds = completionsForMenu2.map((c) => c.menu_slot_id)
      expect(menu2SlotIds).toContain(slot2Id)
      expect(menu2SlotIds).not.toContain(seed.menuSlotId)
    } finally {
      // Cascade delete cleans up slot2 completion and the slot itself
      await fixture.supabase.from('menus').delete().eq('id', menu2Id)
    }
  })
})
