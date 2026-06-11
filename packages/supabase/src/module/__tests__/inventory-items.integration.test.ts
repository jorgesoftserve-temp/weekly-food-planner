import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import {
  listInventoryItems,
  createInventoryItem,
  updateInventoryItem,
  deleteInventoryItem,
} from '../inventory-items.js'
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
  `wfp-inv-test-${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.test`

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

describe.skipIf(!INTEGRATION_ENABLED)('inventory-items (integration)', () => {
  let fixture: IntegrationFixture
  /** workspace_members.id of the creator user inside the fixture workspace */
  let creatorMemberId: string
  /** A real ingredient seeded by the service-role client (catalog is service-managed). */
  let ingredientId: string

  beforeAll(async () => {
    fixture = await createIntegrationFixture()

    // Seed an ingredient using the service-role client (ingredients require
    // service-role for INSERT per DATABASE_PRD §8 — catalog is not user-writable).
    const { data: ing, error: ingErr } = await fixture.supabase
      .from('ingredients')
      .insert({
        name: `Test Carrot ${Date.now()}`,
        is_perishable: true,
        max_storage_days: 14,
        requires_fresh: false,
        same_day_cook: false,
      })
      .select('id')
      .single()
    if (ingErr || !ing) throw new Error(`ingredient seed failed: ${ingErr?.message ?? 'no row'}`)
    ingredientId = (ing as { id: string }).id

    // Resolve the creator's workspace_members row. The signup trigger creates it.
    const { data: member, error: memErr } = await fixture.supabase
      .from('workspace_members')
      .select('id')
      .eq('workspace_id', fixture.workspaceId)
      .eq('user_id', fixture.userId)
      .eq('is_deleted', false)
      .maybeSingle()
    if (memErr || !member) {
      throw new Error(`creator member row not found: ${memErr?.message ?? 'no row'}`)
    }
    creatorMemberId = (member as { id: string }).id
  })

  afterAll(async () => {
    await fixture?.cleanup()
  })

  // -------------------------------------------------------------------------
  // 1. CRUD happy path (service-role client acts as creator/admin)
  // -------------------------------------------------------------------------
  it('creates an inventory item, lists it, updates quantity/expiration_date/label, marks consumed, then hard-deletes it', async () => {
    // Arrange / Act — create
    const { id: itemId } = await createInventoryItem({
      supabase: fixture.supabase,
      workspaceId: fixture.workspaceId,
      payload: {
        ingredient_id: ingredientId,
        source: 'manual',
        quantity: 3,
        unit: 'piece',
        expiration_date: '2099-12-31',
        label: 'organic batch',
        created_by: creatorMemberId,
      },
    })
    expect(itemId).toMatch(/^[0-9a-f-]{36}$/)

    // Assert — it appears in the list
    const list = await listInventoryItems({
      supabase: fixture.supabase,
      workspaceId: fixture.workspaceId,
    })
    const found = list.find((i) => i.id === itemId)
    expect(found).toBeDefined()
    expect(found?.ingredient_id).toBe(ingredientId)
    expect(found?.source).toBe('manual')
    expect(found?.label).toBe('organic batch')
    expect(found?.expiration_date).toBe('2099-12-31')
    expect(found?.is_consumed).toBe(false)

    // Act — update quantity, expiration_date, label
    await updateInventoryItem({
      supabase: fixture.supabase,
      workspaceId: fixture.workspaceId,
      itemId,
      patch: { quantity: 5, expiration_date: '2099-06-30', label: 'freezer stash' },
    })
    const afterUpdate = await listInventoryItems({
      supabase: fixture.supabase,
      workspaceId: fixture.workspaceId,
    })
    const updatedRow = afterUpdate.find((i) => i.id === itemId)
    expect(updatedRow?.quantity).toBe(5)
    expect(updatedRow?.expiration_date).toBe('2099-06-30')
    expect(updatedRow?.label).toBe('freezer stash')

    // Act — mark consumed
    await updateInventoryItem({
      supabase: fixture.supabase,
      workspaceId: fixture.workspaceId,
      itemId,
      patch: { is_consumed: true },
    })

    // Assert — not in default list (includeConsumed defaults to false)
    const afterConsumed = await listInventoryItems({
      supabase: fixture.supabase,
      workspaceId: fixture.workspaceId,
    })
    expect(afterConsumed.find((i) => i.id === itemId)).toBeUndefined()

    // Act — hard delete
    await deleteInventoryItem({
      supabase: fixture.supabase,
      workspaceId: fixture.workspaceId,
      itemId,
    })

    // Assert — gone even with includeConsumed=true
    const afterDelete = await listInventoryItems({
      supabase: fixture.supabase,
      workspaceId: fixture.workspaceId,
      includeConsumed: true,
    })
    expect(afterDelete.find((i) => i.id === itemId)).toBeUndefined()
  })

  // -------------------------------------------------------------------------
  // 2. is_consumed visibility
  // -------------------------------------------------------------------------
  it('listInventoryItems excludes consumed rows by default and includes them when includeConsumed=true', async () => {
    // Arrange — two items: one active, one consumed
    const { id: activeId } = await createInventoryItem({
      supabase: fixture.supabase,
      workspaceId: fixture.workspaceId,
      payload: { ingredient_id: ingredientId, quantity: 1, unit: 'g', created_by: creatorMemberId },
    })
    const { id: consumedId } = await createInventoryItem({
      supabase: fixture.supabase,
      workspaceId: fixture.workspaceId,
      payload: { ingredient_id: ingredientId, quantity: 2, unit: 'g', created_by: creatorMemberId },
    })
    await updateInventoryItem({
      supabase: fixture.supabase,
      workspaceId: fixture.workspaceId,
      itemId: consumedId,
      patch: { is_consumed: true },
    })

    // Act — default (includeConsumed=false)
    const activeOnly = await listInventoryItems({
      supabase: fixture.supabase,
      workspaceId: fixture.workspaceId,
    })
    expect(activeOnly.some((i) => i.id === activeId)).toBe(true)
    expect(activeOnly.some((i) => i.id === consumedId)).toBe(false)

    // Act — includeConsumed=true
    const withConsumed = await listInventoryItems({
      supabase: fixture.supabase,
      workspaceId: fixture.workspaceId,
      includeConsumed: true,
    })
    expect(withConsumed.some((i) => i.id === activeId)).toBe(true)
    expect(withConsumed.some((i) => i.id === consumedId)).toBe(true)

    // Cleanup
    await fixture.supabase.from('inventory_items').delete().in('id', [activeId, consumedId])
  })

  // -------------------------------------------------------------------------
  // 3. RLS read — member can read; non-member is denied
  // -------------------------------------------------------------------------
  it('allows an active workspace member to read inventory items via RLS', async () => {
    // Arrange — seed an item via service-role
    const { id: itemId } = await createInventoryItem({
      supabase: fixture.supabase,
      workspaceId: fixture.workspaceId,
      payload: { ingredient_id: ingredientId, quantity: 4, unit: 'cup', created_by: creatorMemberId },
    })

    // Act — sign in as the fixture creator and read via user-scoped client.
    // Resolve the creator's email via the admin API (fixture only exposes userId).
    const { data: userRow } = await fixture.supabase.auth.admin.getUserById(fixture.userId)
    const creatorEmail = userRow?.user?.email
    if (!creatorEmail) throw new Error('could not resolve creator email from fixture')

    const userClient = await createUserClient({ email: creatorEmail, password: TEST_PASSWORD })
    const userList = await listInventoryItems({
      supabase: userClient,
      workspaceId: fixture.workspaceId,
    })
    expect(userList.some((i) => i.id === itemId)).toBe(true)

    // Cleanup
    await fixture.supabase.from('inventory_items').delete().eq('id', itemId)
  })

  it('denies a non-member from reading inventory items (RLS returns empty set)', async () => {
    // Arrange — seed an item
    const { id: itemId } = await createInventoryItem({
      supabase: fixture.supabase,
      workspaceId: fixture.workspaceId,
      payload: { ingredient_id: ingredientId, quantity: 1, unit: 'ml', created_by: creatorMemberId },
    })

    // Arrange — create a second user who is NOT a member of fixture.workspaceId
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
      // Act — outsider tries to read the fixture workspace's inventory
      const outsiderList = await listInventoryItems({
        supabase: outsiderClient,
        workspaceId: fixture.workspaceId,
      })
      // RLS policy fn_user_workspace_role returns NULL → no rows returned (not an error)
      expect(outsiderList.find((i) => i.id === itemId)).toBeUndefined()
    } finally {
      await fixture.supabase.auth.admin.deleteUser(outsiderUserId)
      await fixture.supabase.from('inventory_items').delete().eq('id', itemId)
    }
  })

  // -------------------------------------------------------------------------
  // 4a. RLS write — non-member cannot insert/update/delete
  // -------------------------------------------------------------------------
  it('denies a non-member from inserting an inventory item (RLS write policy)', async () => {
    // Arrange — create an outsider user (no membership in fixture workspace)
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
      // Act — outsider tries to insert directly (bypassing the module to inspect the raw error)
      const { error } = await outsiderClient.from('inventory_items').insert({
        workspace_id: fixture.workspaceId,
        ingredient_id: ingredientId,
        source: 'manual',
        quantity: 1,
        unit: 'piece',
      })
      // Assert — RLS denies; PostgREST returns code 42501 (insufficient privilege)
      expect(error).not.toBeNull()
      expect(error?.code).toBe('42501')
    } finally {
      await fixture.supabase.auth.admin.deleteUser(outsiderUserId)
    }
  })

  it('denies a non-member from updating an inventory item (RLS write policy)', async () => {
    // Arrange — seed an item
    const { id: itemId } = await createInventoryItem({
      supabase: fixture.supabase,
      workspaceId: fixture.workspaceId,
      payload: { ingredient_id: ingredientId, quantity: 10, unit: 'kg', created_by: creatorMemberId },
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
      const { error } = await outsiderClient
        .from('inventory_items')
        .update({ quantity: 99 })
        .eq('id', itemId)
      // RLS USING clause on UPDATE returns 0 rows affected — no error thrown but
      // confirm the row is unchanged via service-role read.
      const { data: row } = await fixture.supabase
        .from('inventory_items')
        .select('quantity')
        .eq('id', itemId)
        .single()
      // Quantity must remain 10 — outsider's UPDATE was silently blocked by RLS.
      expect(Number((row as { quantity: string | number })?.quantity)).toBe(10)
      // PostgREST may or may not return an explicit error for UPDATE denials; either
      // way the row must be untouched.
      if (error) expect(error.code).toBe('42501')
    } finally {
      await fixture.supabase.auth.admin.deleteUser(outsiderUserId)
      await fixture.supabase.from('inventory_items').delete().eq('id', itemId)
    }
  })

  it('denies a non-member from deleting an inventory item (RLS write policy)', async () => {
    // Arrange — seed an item
    const { id: itemId } = await createInventoryItem({
      supabase: fixture.supabase,
      workspaceId: fixture.workspaceId,
      payload: { ingredient_id: ingredientId, quantity: 7, unit: 'piece', created_by: creatorMemberId },
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
      await outsiderClient.from('inventory_items').delete().eq('id', itemId)

      // Item must still exist — RLS blocked the delete
      const { data: stillThere } = await fixture.supabase
        .from('inventory_items')
        .select('id')
        .eq('id', itemId)
        .maybeSingle()
      expect(stillThere).not.toBeNull()
    } finally {
      await fixture.supabase.auth.admin.deleteUser(outsiderUserId)
      await fixture.supabase.from('inventory_items').delete().eq('id', itemId)
    }
  })

  // -------------------------------------------------------------------------
  // 4b. DB constraint — negative quantity rejected at the DB layer
  // -------------------------------------------------------------------------
  it('rejects a negative quantity at the DB layer (CHECK quantity >= 0)', async () => {
    const { error } = await fixture.supabase.from('inventory_items').insert({
      workspace_id: fixture.workspaceId,
      ingredient_id: ingredientId,
      source: 'manual',
      quantity: -1,
      unit: 'piece',
    })
    expect(error).not.toBeNull()
    // PostgreSQL CHECK violation → error code 23514
    expect(error?.code).toBe('23514')
  })

  // -------------------------------------------------------------------------
  // 5. created_by persists the caller's workspace_members.id
  // -------------------------------------------------------------------------
  it('persists created_by as the provided workspace_members.id', async () => {
    const { id: itemId } = await createInventoryItem({
      supabase: fixture.supabase,
      workspaceId: fixture.workspaceId,
      payload: {
        ingredient_id: ingredientId,
        quantity: 2,
        unit: 'tbsp',
        created_by: creatorMemberId,
      },
    })

    const { data: row, error } = await fixture.supabase
      .from('inventory_items')
      .select('id, created_by')
      .eq('id', itemId)
      .single()
    expect(error).toBeNull()
    expect((row as { id: string; created_by: string })?.created_by).toBe(creatorMemberId)

    // Cleanup
    await fixture.supabase.from('inventory_items').delete().eq('id', itemId)
  })

  // -------------------------------------------------------------------------
  // 6. quantity numeric coercion — module returns JS number, not string
  // -------------------------------------------------------------------------
  it('returns quantity as a JS number (PostgREST numeric coercion in module)', async () => {
    const { id: itemId } = await createInventoryItem({
      supabase: fixture.supabase,
      workspaceId: fixture.workspaceId,
      payload: {
        ingredient_id: ingredientId,
        quantity: 1.5,
        unit: 'cup',
        created_by: creatorMemberId,
      },
    })

    const list = await listInventoryItems({
      supabase: fixture.supabase,
      workspaceId: fixture.workspaceId,
    })
    const row = list.find((i) => i.id === itemId)
    expect(row).toBeDefined()
    // The module's toRecord() coerces the PostgREST numeric string to a number.
    expect(typeof row?.quantity).toBe('number')
    expect(row?.quantity).toBe(1.5)

    // Cleanup
    await fixture.supabase.from('inventory_items').delete().eq('id', itemId)
  })
})
