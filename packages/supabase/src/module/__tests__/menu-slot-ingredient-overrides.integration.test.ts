import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import {
  getOverridesForMenu,
  upsertMenuSlotIngredientOverride,
  deleteMenuSlotIngredientOverride,
} from '../menu-slot-ingredient-overrides.js'
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
  `wfp-override-test-${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.test`

// ---------------------------------------------------------------------------
// Seed helpers (service-role only — schema-dependent rows)
// ---------------------------------------------------------------------------

type SeedState = {
  menuId: string
  menuSlotId: string
  creatorMemberId: string
  recipeId: string
  ingredientAId: string
  ingredientBId: string
}

/**
 * Seeds the minimal DB state needed to test menu_slot_ingredient_overrides:
 *   2 ingredients (catalog) → recipe → accepted menu → menu_slot
 *
 * All inserts use the service-role client so RLS does not interfere with
 * setup; the tests themselves use user-scoped clients where relevant.
 */
const seedOverrideFixture = async ({
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

  // 2. Seed two catalog ingredients — ingredient A is the original, B is the substitute.
  const { data: ingA, error: ingAErr } = await supabase
    .from('ingredients')
    .insert({
      name: `Override Ing A ${Date.now()}`,
      is_perishable: false,
      max_storage_days: 30,
      requires_fresh: false,
      same_day_cook: false,
    })
    .select('id')
    .single()
  if (ingAErr || !ingA) throw new Error(`ingredient A seed failed: ${ingAErr?.message ?? 'no row'}`)
  const ingredientAId = (ingA as { id: string }).id

  const { data: ingB, error: ingBErr } = await supabase
    .from('ingredients')
    .insert({
      name: `Override Ing B ${Date.now()}`,
      is_perishable: false,
      max_storage_days: 30,
      requires_fresh: false,
      same_day_cook: false,
    })
    .select('id')
    .single()
  if (ingBErr || !ingB) throw new Error(`ingredient B seed failed: ${ingBErr?.message ?? 'no row'}`)
  const ingredientBId = (ingB as { id: string }).id

  // 3. Seed a recipe in the workspace (service-role bypasses RLS).
  const { data: recipe, error: recipeErr } = await supabase
    .from('recipes')
    .insert({
      workspace_id: workspaceId,
      name: `Override Test Recipe ${Date.now()}`,
      meal_type: 'dinner',
      difficulty: 'easy',
      servings: 4,
      is_deleted: false,
    })
    .select('id')
    .single()
  if (recipeErr || !recipe) throw new Error(`recipe seed failed: ${recipeErr?.message ?? 'no row'}`)
  const recipeId = (recipe as { id: string }).id

  // 4. Insert an accepted menu (accepted_at non-null → accepted state).
  const { data: menu, error: menuErr } = await supabase
    .from('menus')
    .insert({
      workspace_id: workspaceId,
      week_start_date: '2099-05-05',
      seed: 42,
      inputs_hash: `override-hash-${Date.now()}`,
      generation_options: {},
      accepted_at: new Date().toISOString(),
      accepted_seed: '42',
      is_deleted: false,
      duration_days: 7,
    })
    .select('id')
    .single()
  if (menuErr || !menu) throw new Error(`menu seed failed: ${menuErr?.message ?? 'no row'}`)
  const menuId = (menu as { id: string }).id

  // 5. Insert a menu_slot that references the recipe.
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

  return { menuId, menuSlotId, creatorMemberId, recipeId, ingredientAId, ingredientBId }
}

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

describe.skipIf(!INTEGRATION_ENABLED)('menu-slot-ingredient-overrides (integration)', () => {
  let fixture: IntegrationFixture
  let seed: SeedState

  beforeAll(async () => {
    fixture = await createIntegrationFixture()
    seed = await seedOverrideFixture({
      supabase: fixture.supabase,
      workspaceId: fixture.workspaceId,
      userId: fixture.userId,
    })
  })

  afterAll(async () => {
    // Service-role cleanup — cascade deletes handle overrides automatically
    // when the menu is deleted, which cascades through menu_slots.
    if (seed?.menuId) {
      await fixture?.supabase.from('menus').delete().eq('id', seed.menuId)
    }
    if (seed?.recipeId) {
      await fixture?.supabase.from('recipes').delete().eq('id', seed.recipeId)
    }
    if (seed?.ingredientAId) {
      await fixture?.supabase.from('ingredients').delete().eq('id', seed.ingredientAId)
    }
    if (seed?.ingredientBId) {
      await fixture?.supabase.from('ingredients').delete().eq('id', seed.ingredientBId)
    }
    await fixture?.cleanup()
  })

  // -------------------------------------------------------------------------
  // 1. Happy path: upsert creates a row; getOverridesForMenu returns it with
  //    quantity coerced to number (or null).
  // -------------------------------------------------------------------------
  it('upsert creates an override row and getOverridesForMenu returns it with quantity coerced to number', async () => {
    // Arrange — clean state (no overrides yet for this menu)
    const before = await getOverridesForMenu({
      supabase: fixture.supabase,
      menuId: seed.menuId,
    })
    expect(before).toHaveLength(0)

    // Act
    const row = await upsertMenuSlotIngredientOverride({
      supabase: fixture.supabase,
      payload: {
        menu_slot_id: seed.menuSlotId,
        workspace_id: fixture.workspaceId,
        original_ingredient_id: seed.ingredientAId,
        substitute_ingredient_id: seed.ingredientBId,
        quantity: 1.5,
        unit: 'cup',
        note: 'use the organic one',
        created_by: seed.creatorMemberId,
      },
    })

    // Assert — row created
    expect(row.id).toMatch(/^[0-9a-f-]{36}$/)
    expect(row.menu_slot_id).toBe(seed.menuSlotId)
    expect(row.workspace_id).toBe(fixture.workspaceId)
    expect(row.original_ingredient_id).toBe(seed.ingredientAId)
    expect(row.substitute_ingredient_id).toBe(seed.ingredientBId)
    expect(row.unit).toBe('cup')
    expect(row.note).toBe('use the organic one')
    // quantity must be coerced to a JS number, not a string
    expect(typeof row.quantity).toBe('number')
    expect(row.quantity).toBe(1.5)

    // Assert — getOverridesForMenu returns the row; menu_slot join helper stripped
    const list = await getOverridesForMenu({
      supabase: fixture.supabase,
      menuId: seed.menuId,
    })
    expect(list).toHaveLength(1)
    expect(list[0]!.menu_slot_id).toBe(seed.menuSlotId)
    expect(list[0]!.original_ingredient_id).toBe(seed.ingredientAId)
    expect(typeof list[0]!.quantity).toBe('number')
    expect(list[0]!.quantity).toBe(1.5)
    // The join helper (menu_slot) must be stripped from the returned shape
    expect((list[0] as Record<string, unknown>)['menu_slot']).toBeUndefined()
  })

  // -------------------------------------------------------------------------
  // 2. Idempotent upsert: second upsert on same (menu_slot_id,
  //    original_ingredient_id) updates the substitute in place — still one row.
  // -------------------------------------------------------------------------
  it('upsert is idempotent on (menu_slot_id, original_ingredient_id) — second upsert with different substitute updates in place', async () => {
    // Arrange — seed a second ingredient to use as the new substitute
    const { data: ingC, error: ingCErr } = await fixture.supabase
      .from('ingredients')
      .insert({
        name: `Override Ing C ${Date.now()}`,
        is_perishable: false,
        max_storage_days: 30,
        requires_fresh: false,
        same_day_cook: false,
      })
      .select('id')
      .single()
    if (ingCErr || !ingC) throw new Error(`ingredient C seed failed: ${ingCErr?.message ?? 'no row'}`)
    const ingredientCId = (ingC as { id: string }).id

    try {
      // Act — upsert the same (menu_slot_id, original_ingredient_id) with a different substitute
      const row = await upsertMenuSlotIngredientOverride({
        supabase: fixture.supabase,
        payload: {
          menu_slot_id: seed.menuSlotId,
          workspace_id: fixture.workspaceId,
          original_ingredient_id: seed.ingredientAId,
          substitute_ingredient_id: ingredientCId,
          quantity: null,
          unit: null,
          note: 'switched to C',
          created_by: seed.creatorMemberId,
        },
      })

      // Assert — substitute updated to C
      expect(row.menu_slot_id).toBe(seed.menuSlotId)
      expect(row.original_ingredient_id).toBe(seed.ingredientAId)
      expect(row.substitute_ingredient_id).toBe(ingredientCId)
      expect(row.note).toBe('switched to C')
      // quantity=null must round-trip as null
      expect(row.quantity).toBeNull()

      // Assert — still exactly one override row for this menu
      const list = await getOverridesForMenu({
        supabase: fixture.supabase,
        menuId: seed.menuId,
      })
      expect(list).toHaveLength(1)
      expect(list[0]!.substitute_ingredient_id).toBe(ingredientCId)
    } finally {
      // Restore the original substitute so subsequent tests use a known state
      await upsertMenuSlotIngredientOverride({
        supabase: fixture.supabase,
        payload: {
          menu_slot_id: seed.menuSlotId,
          workspace_id: fixture.workspaceId,
          original_ingredient_id: seed.ingredientAId,
          substitute_ingredient_id: seed.ingredientBId,
          created_by: seed.creatorMemberId,
        },
      })
      await fixture.supabase.from('ingredients').delete().eq('id', ingredientCId)
    }
  })

  // -------------------------------------------------------------------------
  // 3. Delete removes the row; getOverridesForMenu is empty afterwards.
  // -------------------------------------------------------------------------
  it('deleteMenuSlotIngredientOverride removes the row and getOverridesForMenu is empty afterwards', async () => {
    // Arrange — verify there is exactly one row before deleting
    const before = await getOverridesForMenu({
      supabase: fixture.supabase,
      menuId: seed.menuId,
    })
    expect(before).toHaveLength(1)

    // Act
    await deleteMenuSlotIngredientOverride({
      supabase: fixture.supabase,
      menuSlotId: seed.menuSlotId,
      originalIngredientId: seed.ingredientAId,
    })

    // Assert — list is now empty for this menu
    const after = await getOverridesForMenu({
      supabase: fixture.supabase,
      menuId: seed.menuId,
    })
    expect(after).toHaveLength(0)
  })

  // -------------------------------------------------------------------------
  // 4. RLS read: non-member gets an empty set (not an error)
  // -------------------------------------------------------------------------
  it('denies a non-member from reading overrides — RLS returns empty set, not an error', async () => {
    // Arrange — re-seed an override row so there is something to be hidden
    await upsertMenuSlotIngredientOverride({
      supabase: fixture.supabase,
      payload: {
        menu_slot_id: seed.menuSlotId,
        workspace_id: fixture.workspaceId,
        original_ingredient_id: seed.ingredientAId,
        substitute_ingredient_id: seed.ingredientBId,
        created_by: seed.creatorMemberId,
      },
    })

    // Arrange — create a user who has no membership in fixture.workspaceId
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

      // Act — outsider calls getOverridesForMenu for the fixture's menu
      const overrides = await getOverridesForMenu({
        supabase: outsiderClient,
        menuId: seed.menuId,
      })

      // Assert — RLS returns empty set; function must not throw
      expect(overrides).toHaveLength(0)
    } finally {
      await fixture.supabase.auth.admin.deleteUser(outsiderUserId)
    }
  })

  // -------------------------------------------------------------------------
  // 5. RLS write: non-member's insert is denied (WITH CHECK blocks the INSERT)
  // -------------------------------------------------------------------------
  it('denies a non-member from inserting an override (RLS write policy, code 42501)', async () => {
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

      // Act — outsider tries to insert directly (bypassing the module to inspect
      // the raw PostgREST error code)
      const { error } = await outsiderClient.from('menu_slot_ingredient_overrides').insert({
        menu_slot_id: seed.menuSlotId,
        workspace_id: fixture.workspaceId,
        original_ingredient_id: seed.ingredientAId,
        substitute_ingredient_id: seed.ingredientBId,
      })

      // Assert — RLS WITH CHECK blocks the insert; PostgREST returns 42501
      expect(error).not.toBeNull()
      expect(error?.code).toBe('42501')
    } finally {
      await fixture.supabase.auth.admin.deleteUser(outsiderUserId)
    }
  })

  // -------------------------------------------------------------------------
  // 6. Cross-menu isolation: an override on menu A's slot does not appear
  //    in getOverridesForMenu(menuB).
  // -------------------------------------------------------------------------
  it('getOverridesForMenu only returns overrides for the queried menu (cross-menu isolation)', async () => {
    // Arrange — create a second menu with its own slot; no overrides on it
    const { data: menuB, error: menuBErr } = await fixture.supabase
      .from('menus')
      .insert({
        workspace_id: fixture.workspaceId,
        week_start_date: '2099-06-02',
        seed: 99,
        inputs_hash: `override-isolation-${Date.now()}`,
        generation_options: {},
        accepted_at: new Date().toISOString(),
        accepted_seed: '99',
        is_deleted: false,
        duration_days: 7,
      })
      .select('id')
      .single()
    if (menuBErr || !menuB) throw new Error(`menuB seed failed: ${menuBErr?.message ?? 'no row'}`)
    const menuBId = (menuB as { id: string }).id

    const { data: slotB, error: slotBErr } = await fixture.supabase
      .from('menu_slots')
      .insert({
        menu_id: menuBId,
        day_of_week: 'tuesday',
        meal_key: 'dinner_tuesday',
        meal_type: 'dinner',
        recipe_id: seed.recipeId,
        target_member_id: null,
      })
      .select('id')
      .single()
    if (slotBErr || !slotB) throw new Error(`slotB seed failed: ${slotBErr?.message ?? 'no row'}`)

    try {
      // Act — query overrides for menuA (has the seeded override from test 4)
      const overridesA = await getOverridesForMenu({
        supabase: fixture.supabase,
        menuId: seed.menuId,
      })
      // Act — query overrides for menuB (no overrides)
      const overridesB = await getOverridesForMenu({
        supabase: fixture.supabase,
        menuId: menuBId,
      })

      // Assert — menuA returns the override on its slot
      const menuASlotIds = overridesA.map((o) => o.menu_slot_id)
      expect(menuASlotIds).toContain(seed.menuSlotId)
      expect(menuASlotIds).not.toContain((slotB as { id: string }).id)

      // Assert — menuB has no overrides
      expect(overridesB).toHaveLength(0)
    } finally {
      // Cascade delete through menu_slots cleans up slotB automatically.
      await fixture.supabase.from('menus').delete().eq('id', menuBId)
    }
  })
})
