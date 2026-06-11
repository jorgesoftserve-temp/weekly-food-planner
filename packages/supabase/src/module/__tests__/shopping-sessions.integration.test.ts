import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import {
  openShoppingSession,
  getActiveShoppingSession,
  getShoppingSessionById,
  updateShoppingSession,
} from '../shopping-sessions.js'
import { updateShoppingItemStatus } from '../shopping-item-status.js'
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
  `wfp-shop-test-${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.test`

// ---------------------------------------------------------------------------
// Seed helpers (service-role only — catalog / schema-dependent rows)
// ---------------------------------------------------------------------------

type SeedState = {
  ingredientId: string
  menuId: string
  groceryListId: string
  groceryItemIds: string[]
  creatorMemberId: string
}

/**
 * Seeds the minimal DB state needed to open a shopping session:
 *   ingredient → menu (accepted) → grocery_list → grocery_items (x3)
 *
 * All inserts use the service-role client so RLS does not interfere with
 * setup; the tests themselves use user-scoped clients where relevant.
 */
const seedShoppingFixture = async ({
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

  // 2. Seed an ingredient (catalog is service-role only).
  const { data: ing, error: ingErr } = await supabase
    .from('ingredients')
    .insert({
      name: `Test Tomato ${Date.now()}`,
      is_perishable: true,
      max_storage_days: 7,
      requires_fresh: false,
      same_day_cook: false,
      food_group: 'vegetables',
      food_group_source: 'seed',
    })
    .select('id')
    .single()
  if (ingErr || !ing) throw new Error(`ingredient seed failed: ${ingErr?.message ?? 'no row'}`)
  const ingredientId = (ing as { id: string }).id

  // 3. Insert an accepted menu (accepted_at must be non-null so the FK
  //    relationship the shopping session relies on resolves correctly).
  const { data: menu, error: menuErr } = await supabase
    .from('menus')
    .insert({
      workspace_id: workspaceId,
      week_start_date: '2099-01-06',
      seed: 42,
      inputs_hash: `test-hash-${Date.now()}`,
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

  // 4. Insert a grocery_list for that menu.
  const { data: list, error: listErr } = await supabase
    .from('grocery_lists')
    .insert({ menu_id: menuId, target_member_id: null })
    .select('id')
    .single()
  if (listErr || !list) throw new Error(`grocery_list seed failed: ${listErr?.message ?? 'no row'}`)
  const groceryListId = (list as { id: string }).id

  // 5. Insert 3 grocery_items referencing the seeded ingredient.
  // The FK column is `list_id` (not `grocery_list_id`) — confirmed from live schema.
  const { data: items, error: itemsErr } = await supabase
    .from('grocery_items')
    .insert([
      { list_id: groceryListId, ingredient_id: ingredientId, quantity: 2, unit: 'piece' },
      { list_id: groceryListId, ingredient_id: ingredientId, quantity: 3, unit: 'piece' },
      { list_id: groceryListId, ingredient_id: ingredientId, quantity: 1, unit: 'cup' },
    ])
    .select('id')
  if (itemsErr || !items) throw new Error(`grocery_items seed failed: ${itemsErr?.message ?? 'no row'}`)
  const groceryItemIds = (items as { id: string }[]).map((r) => r.id)

  return { ingredientId, menuId, groceryListId, groceryItemIds, creatorMemberId }
}

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

describe.skipIf(!INTEGRATION_ENABLED)('shopping-sessions (integration)', () => {
  let fixture: IntegrationFixture
  let seed: SeedState

  beforeAll(async () => {
    fixture = await createIntegrationFixture()
    seed = await seedShoppingFixture({
      supabase: fixture.supabase,
      workspaceId: fixture.workspaceId,
      userId: fixture.userId,
    })
  })

  afterAll(async () => {
    // Service-role cleanup — cascade deletes handle shopping_sessions,
    // shopping_item_status, grocery_items, grocery_lists automatically.
    if (seed?.menuId) {
      await fixture?.supabase.from('menus').delete().eq('id', seed.menuId)
    }
    if (seed?.ingredientId) {
      await fixture?.supabase.from('ingredients').delete().eq('id', seed.ingredientId)
    }
    await fixture?.cleanup()
  })

  // -------------------------------------------------------------------------
  // 1. Open + seed: openShoppingSession creates session + N status rows
  // -------------------------------------------------------------------------
  it('openShoppingSession creates an in_progress session with N pending shopping_item_status rows', async () => {
    // Arrange — fresh menu for this test so there is no leftover in_progress session
    const { data: menu, error: menuErr } = await fixture.supabase
      .from('menus')
      .insert({
        workspace_id: fixture.workspaceId,
        week_start_date: '2099-02-03',
        seed: 99,
        inputs_hash: `test-hash-open-${Date.now()}`,
        generation_options: {},
        accepted_at: new Date().toISOString(),
        accepted_seed: '99',
        is_deleted: false,
        duration_days: 7,
      })
      .select('id')
      .single()
    if (menuErr || !menu) throw new Error(`menu seed failed: ${menuErr?.message}`)
    const menuId = (menu as { id: string }).id

    try {
      // Act
      const { id: sessionId } = await openShoppingSession({
        supabase: fixture.supabase,
        workspaceId: fixture.workspaceId,
        menuId,
        groceryItemIds: seed.groceryItemIds,
        createdBy: seed.creatorMemberId,
      })

      // Assert — session row
      expect(sessionId).toMatch(/^[0-9a-f-]{36}$/)

      // Assert — getActiveShoppingSession returns it with joined items
      const session = await getActiveShoppingSession({ supabase: fixture.supabase, menuId })
      expect(session).not.toBeNull()
      expect(session!.id).toBe(sessionId)
      expect(session!.status).toBe('in_progress')
      expect(session!.items).toHaveLength(seed.groceryItemIds.length)

      // All items are pending with acquired_quantity === 0
      for (const item of session!.items) {
        expect(item.status).toBe('pending')
        expect(item.acquired_quantity).toBe(0)
        expect(typeof item.acquired_quantity).toBe('number') // numeric coercion
      }

      // grocery_item.ingredient.food_group is present (the joined shape)
      const firstItem = session!.items[0]!
      expect(firstItem.grocery_item).not.toBeNull()
      expect(firstItem.grocery_item?.ingredient).not.toBeNull()
      expect(firstItem.grocery_item?.ingredient?.food_group).toBe('vegetables')
    } finally {
      await fixture.supabase.from('menus').delete().eq('id', menuId)
    }
  })

  // -------------------------------------------------------------------------
  // 2. Duplicate-open guard: partial unique index (menu_id) WHERE in_progress
  // -------------------------------------------------------------------------
  it('openShoppingSession throws when an in_progress session already exists for the menu', async () => {
    // Arrange — open a session on the shared seed menu
    const { id: firstId } = await openShoppingSession({
      supabase: fixture.supabase,
      workspaceId: fixture.workspaceId,
      menuId: seed.menuId,
      groceryItemIds: seed.groceryItemIds,
      createdBy: seed.creatorMemberId,
    })
    expect(firstId).toBeTruthy()

    try {
      // Act + Assert — second open must throw due to partial unique index violation
      await expect(
        openShoppingSession({
          supabase: fixture.supabase,
          workspaceId: fixture.workspaceId,
          menuId: seed.menuId,
          groceryItemIds: seed.groceryItemIds,
          createdBy: seed.creatorMemberId,
        }),
      ).rejects.toThrow()
    } finally {
      // Close the session so subsequent tests that use seed.menuId are not blocked
      await fixture.supabase
        .from('shopping_sessions')
        .update({ status: 'complete', completeness: 100 })
        .eq('id', firstId)
    }
  })

  // -------------------------------------------------------------------------
  // 3. Item status update: flip a line to acquired; re-read reflects it
  // -------------------------------------------------------------------------
  it('updateShoppingItemStatus flips a line to acquired and acquired_quantity is a JS number', async () => {
    // Arrange — open a fresh session
    const { id: sessionId } = await openShoppingSession({
      supabase: fixture.supabase,
      workspaceId: fixture.workspaceId,
      menuId: seed.menuId,
      groceryItemIds: seed.groceryItemIds,
      createdBy: seed.creatorMemberId,
    })

    const groceryItemId = seed.groceryItemIds[0]!

    try {
      // Act — flip first item to acquired
      await updateShoppingItemStatus({
        supabase: fixture.supabase,
        sessionId,
        groceryItemId,
        patch: { status: 'acquired', acquired_quantity: 2 },
      })

      // Assert — re-read via getShoppingSessionById
      const session = await getShoppingSessionById({ supabase: fixture.supabase, sessionId })
      expect(session).not.toBeNull()
      const updated = session!.items.find((i) => i.grocery_item_id === groceryItemId)
      expect(updated).toBeDefined()
      expect(updated!.status).toBe('acquired')
      // Module coerces PostgREST numeric string to JS number
      expect(typeof updated!.acquired_quantity).toBe('number')
      expect(updated!.acquired_quantity).toBe(2)

      // Other items remain pending
      const others = session!.items.filter((i) => i.grocery_item_id !== groceryItemId)
      for (const other of others) {
        expect(other.status).toBe('pending')
      }
    } finally {
      await fixture.supabase.from('shopping_sessions').delete().eq('id', sessionId)
    }
  })

  // -------------------------------------------------------------------------
  // 4. Finalize transition: complete session allows a new in_progress open
  // -------------------------------------------------------------------------
  it('after updateShoppingSession to complete a second openShoppingSession succeeds for the same menu', async () => {
    // Arrange — open a session
    const { id: sessionId } = await openShoppingSession({
      supabase: fixture.supabase,
      workspaceId: fixture.workspaceId,
      menuId: seed.menuId,
      groceryItemIds: seed.groceryItemIds,
      createdBy: seed.creatorMemberId,
    })

    // Act — finalize (simulate route handler setting status + completeness)
    await updateShoppingSession({
      supabase: fixture.supabase,
      sessionId,
      patch: { status: 'complete', completeness: 95 },
    })

    // Assert — the row persists with the new values
    const finalized = await getShoppingSessionById({ supabase: fixture.supabase, sessionId })
    expect(finalized).not.toBeNull()
    expect(finalized!.status).toBe('complete')
    expect(finalized!.completeness).toBe(95)

    // Assert — no longer in_progress so a new open is now permitted
    const { id: newSessionId } = await openShoppingSession({
      supabase: fixture.supabase,
      workspaceId: fixture.workspaceId,
      menuId: seed.menuId,
      groceryItemIds: seed.groceryItemIds,
      createdBy: seed.creatorMemberId,
    })
    expect(newSessionId).toMatch(/^[0-9a-f-]{36}$/)
    expect(newSessionId).not.toBe(sessionId)

    // Cleanup — close the new session too so it does not bleed into other tests
    await fixture.supabase
      .from('shopping_sessions')
      .update({ status: 'complete', completeness: 0 })
      .eq('id', newSessionId)
  })

  // -------------------------------------------------------------------------
  // 5. RLS read — member can read; non-member cannot
  // -------------------------------------------------------------------------
  it('allows an active workspace member to read the shopping session and its items via RLS', async () => {
    // Arrange — open a session
    const { id: sessionId } = await openShoppingSession({
      supabase: fixture.supabase,
      workspaceId: fixture.workspaceId,
      menuId: seed.menuId,
      groceryItemIds: seed.groceryItemIds,
      createdBy: seed.creatorMemberId,
    })

    try {
      // Resolve the creator's email via the admin API
      const { data: userRow } = await fixture.supabase.auth.admin.getUserById(fixture.userId)
      const creatorEmail = userRow?.user?.email
      if (!creatorEmail) throw new Error('could not resolve creator email from fixture')

      const userClient = await createUserClient({ email: creatorEmail, password: TEST_PASSWORD })

      // Assert — getActiveShoppingSession returns the session via user-scoped client
      const session = await getActiveShoppingSession({ supabase: userClient, menuId: seed.menuId })
      expect(session).not.toBeNull()
      expect(session!.id).toBe(sessionId)
      expect(session!.items.length).toBeGreaterThan(0)

      // Assert — shopping_item_status rows are also readable (child gates through session)
      const { data: statusRows, error: statusErr } = await userClient
        .from('shopping_item_status')
        .select('id')
        .eq('session_id', sessionId)
      expect(statusErr).toBeNull()
      expect((statusRows ?? []).length).toBe(seed.groceryItemIds.length)
    } finally {
      await fixture.supabase.from('shopping_sessions').delete().eq('id', sessionId)
    }
  })

  it('denies a non-member from reading the shopping session and its items (RLS returns empty set)', async () => {
    // Arrange — open a session
    const { id: sessionId } = await openShoppingSession({
      supabase: fixture.supabase,
      workspaceId: fixture.workspaceId,
      menuId: seed.menuId,
      groceryItemIds: seed.groceryItemIds,
      createdBy: seed.creatorMemberId,
    })

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

      // Assert — shopping_sessions: RLS returns empty set, not an error
      const { data: sessions, error: sessErr } = await outsiderClient
        .from('shopping_sessions')
        .select('id')
        .eq('workspace_id', fixture.workspaceId)
      expect(sessErr).toBeNull()
      expect(sessions ?? []).toHaveLength(0)

      // Assert — shopping_item_status: RLS gates through session; also empty
      const { data: statusRows, error: statusErr } = await outsiderClient
        .from('shopping_item_status')
        .select('id')
        .eq('session_id', sessionId)
      expect(statusErr).toBeNull()
      expect(statusRows ?? []).toHaveLength(0)
    } finally {
      await fixture.supabase.auth.admin.deleteUser(outsiderUserId)
      await fixture.supabase.from('shopping_sessions').delete().eq('id', sessionId)
    }
  })

  // -------------------------------------------------------------------------
  // 6. RLS write — non-member cannot insert session or update item status
  // -------------------------------------------------------------------------
  it('denies a non-member from inserting a shopping session (RLS write policy)', async () => {
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

      // Act — outsider tries to insert a shopping session directly
      const { error } = await outsiderClient.from('shopping_sessions').insert({
        menu_id: seed.menuId,
        workspace_id: fixture.workspaceId,
        status: 'in_progress',
      })

      // Assert — RLS denies; PostgREST returns 42501
      expect(error).not.toBeNull()
      expect(error?.code).toBe('42501')
    } finally {
      await fixture.supabase.auth.admin.deleteUser(outsiderUserId)
    }
  })

  it('denies a non-member from updating a shopping_item_status row (RLS write policy)', async () => {
    // Arrange — open a session via service-role
    const { id: sessionId } = await openShoppingSession({
      supabase: fixture.supabase,
      workspaceId: fixture.workspaceId,
      menuId: seed.menuId,
      groceryItemIds: seed.groceryItemIds,
      createdBy: seed.creatorMemberId,
    })

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

      // Act — outsider tries to update the first item's status directly
      const { error } = await outsiderClient
        .from('shopping_item_status')
        .update({ status: 'acquired', acquired_quantity: 99 })
        .eq('session_id', sessionId)

      // RLS USING clause on UPDATE blocks all rows visible to the outsider
      // (none — their read policy also returns empty). PostgREST may either
      // return 42501 or 0 rows affected. Either way the rows must be untouched.
      if (error) expect(error.code).toBe('42501')

      // Assert — row was NOT changed (service-role read confirms)
      const { data: rows } = await fixture.supabase
        .from('shopping_item_status')
        .select('status, acquired_quantity')
        .eq('session_id', sessionId)
      const allUntouched = (rows ?? []).every(
        (r) =>
          (r as { status: string; acquired_quantity: string | number }).status === 'pending' &&
          Number((r as { status: string; acquired_quantity: string | number }).acquired_quantity) === 0,
      )
      expect(allUntouched).toBe(true)
    } finally {
      await fixture.supabase.auth.admin.deleteUser(outsiderUserId)
      await fixture.supabase.from('shopping_sessions').delete().eq('id', sessionId)
    }
  })

  // -------------------------------------------------------------------------
  // 7. acquired_quantity CHECK — negative value rejected at DB layer
  // -------------------------------------------------------------------------
  it('rejects a negative acquired_quantity at the DB layer (CHECK acquired_quantity >= 0)', async () => {
    // Arrange — open a session and grab the first item
    const { id: sessionId } = await openShoppingSession({
      supabase: fixture.supabase,
      workspaceId: fixture.workspaceId,
      menuId: seed.menuId,
      groceryItemIds: seed.groceryItemIds,
      createdBy: seed.creatorMemberId,
    })

    try {
      const groceryItemId = seed.groceryItemIds[0]

      // Act — bypass the module guard and write directly to the DB
      const { error } = await fixture.supabase
        .from('shopping_item_status')
        .update({ acquired_quantity: -5 })
        .eq('session_id', sessionId)
        .eq('grocery_item_id', groceryItemId)

      // Assert — PostgreSQL CHECK violation → error code 23514
      expect(error).not.toBeNull()
      expect(error?.code).toBe('23514')
    } finally {
      await fixture.supabase.from('shopping_sessions').delete().eq('id', sessionId)
    }
  })
})
