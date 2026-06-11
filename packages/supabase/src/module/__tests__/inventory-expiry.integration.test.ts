import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import {
  listInventoryItems,
  createInventoryItem,
  expireLeftovers,
} from '../inventory-items.js'
import {
  createIntegrationFixture,
  INTEGRATION_ENABLED,
  type IntegrationFixture,
} from '@weekly-food-planner/test-utils'

// ---------------------------------------------------------------------------
// Deterministic "today" for all tests in this suite.
// Fixture rows are created with expiration_dates relative to this constant so
// the tests are clock-free regardless of when CI actually runs.
// ---------------------------------------------------------------------------
const TODAY_YMD = '2026-06-11'
const YESTERDAY_YMD = '2026-06-10' // strictly before TODAY_YMD → expires
const PAST_YMD = '2026-01-01' // well in the past → expires
const TOMORROW_YMD = '2026-06-12' // strictly after TODAY_YMD → not expired

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

describe.skipIf(!INTEGRATION_ENABLED)('inventory-expiry / expireLeftovers (integration)', () => {
  let fixture: IntegrationFixture
  /** workspace_members.id of the creator user inside the fixture workspace */
  let creatorMemberId: string
  /** A real ingredient seeded by the service-role client for all tests. */
  let ingredientId: string
  /** All item ids created in beforeAll for a single-sweep multi-row test. */
  let sweepItemIds: string[] = []

  beforeAll(async () => {
    fixture = await createIntegrationFixture()

    // Seed an ingredient using the service-role client (catalog is not user-writable).
    const { data: ing, error: ingErr } = await fixture.supabase
      .from('ingredients')
      .insert({
        name: `Expiry Test Ingredient ${Date.now()}`,
        is_perishable: true,
        max_storage_days: 7,
        requires_fresh: false,
        same_day_cook: false,
      })
      .select('id')
      .single()
    if (ingErr || !ing) throw new Error(`ingredient seed failed: ${ingErr?.message ?? 'no row'}`)
    ingredientId = (ing as { id: string }).id

    // Resolve the creator's workspace_members row.
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
    // Hard-delete all items created across all tests (cascade-safe if already deleted).
    if (sweepItemIds.length > 0) {
      await fixture?.supabase.from('inventory_items').delete().in('id', sweepItemIds)
    }
    if (ingredientId) {
      await fixture?.supabase.from('ingredients').delete().eq('id', ingredientId)
    }
    await fixture?.cleanup()
  })

  // -------------------------------------------------------------------------
  // Helper to create an item and register its id for afterAll cleanup.
  // -------------------------------------------------------------------------
  const createAndTrack = async (
    payload: Parameters<typeof createInventoryItem>[0]['payload'],
  ): Promise<string> => {
    const { id } = await createInventoryItem({
      supabase: fixture.supabase,
      workspaceId: fixture.workspaceId,
      payload,
    })
    sweepItemIds.push(id)
    return id
  }

  // -------------------------------------------------------------------------
  // 1. leftover row with expiration_date in the past → expires
  // -------------------------------------------------------------------------
  it('marks a leftover row with a past expiration_date as consumed', async () => {
    // Arrange
    const itemId = await createAndTrack({
      ingredient_id: ingredientId,
      source: 'leftover',
      quantity: 2,
      unit: 'piece',
      expiration_date: YESTERDAY_YMD,
      created_by: creatorMemberId,
    })

    // Confirm it is visible before expiry
    const before = await listInventoryItems({
      supabase: fixture.supabase,
      workspaceId: fixture.workspaceId,
    })
    expect(before.some((i) => i.id === itemId)).toBe(true)

    // Act
    const { expiredCount } = await expireLeftovers({
      supabase: fixture.supabase,
      workspaceId: fixture.workspaceId,
      todayYmd: TODAY_YMD,
    })

    // Assert — count ≥ 1 (may include other leftover/cook_remainder rows in workspace)
    expect(expiredCount).toBeGreaterThanOrEqual(1)

    // Assert — item drops out of the default list (is_consumed = true)
    const after = await listInventoryItems({
      supabase: fixture.supabase,
      workspaceId: fixture.workspaceId,
    })
    expect(after.some((i) => i.id === itemId)).toBe(false)

    // Assert — still visible when includeConsumed=true
    const withConsumed = await listInventoryItems({
      supabase: fixture.supabase,
      workspaceId: fixture.workspaceId,
      includeConsumed: true,
    })
    const row = withConsumed.find((i) => i.id === itemId)
    expect(row).toBeDefined()
    expect(row?.is_consumed).toBe(true)
  })

  // -------------------------------------------------------------------------
  // 2. cook_remainder row past expiry → expired too
  // -------------------------------------------------------------------------
  it('marks a cook_remainder row with a past expiration_date as consumed', async () => {
    // Arrange
    const itemId = await createAndTrack({
      ingredient_id: ingredientId,
      source: 'cook_remainder',
      quantity: 1,
      unit: 'cup',
      expiration_date: PAST_YMD,
      created_by: creatorMemberId,
    })

    // Act
    await expireLeftovers({
      supabase: fixture.supabase,
      workspaceId: fixture.workspaceId,
      todayYmd: TODAY_YMD,
    })

    // Assert — item is consumed
    const after = await listInventoryItems({
      supabase: fixture.supabase,
      workspaceId: fixture.workspaceId,
    })
    expect(after.some((i) => i.id === itemId)).toBe(false)

    const withConsumed = await listInventoryItems({
      supabase: fixture.supabase,
      workspaceId: fixture.workspaceId,
      includeConsumed: true,
    })
    const row = withConsumed.find((i) => i.id === itemId)
    expect(row?.is_consumed).toBe(true)
  })

  // -------------------------------------------------------------------------
  // 3. manual row past its expiration_date → NOT expired
  // -------------------------------------------------------------------------
  it('does NOT expire a manual row even when expiration_date is in the past', async () => {
    // Arrange
    const itemId = await createAndTrack({
      ingredient_id: ingredientId,
      source: 'manual',
      quantity: 3,
      unit: 'g',
      expiration_date: YESTERDAY_YMD,
      created_by: creatorMemberId,
    })

    // Act
    await expireLeftovers({
      supabase: fixture.supabase,
      workspaceId: fixture.workspaceId,
      todayYmd: TODAY_YMD,
    })

    // Assert — manual row is still in the default list (not consumed)
    const after = await listInventoryItems({
      supabase: fixture.supabase,
      workspaceId: fixture.workspaceId,
    })
    const row = after.find((i) => i.id === itemId)
    expect(row).toBeDefined()
    expect(row?.is_consumed).toBe(false)

    // Cleanup
    await fixture.supabase.from('inventory_items').delete().eq('id', itemId)
    sweepItemIds = sweepItemIds.filter((id) => id !== itemId)
  })

  // -------------------------------------------------------------------------
  // 4. leftover row with a FUTURE expiration_date → NOT expired
  // -------------------------------------------------------------------------
  it('does NOT expire a leftover row with a future expiration_date', async () => {
    // Arrange
    const itemId = await createAndTrack({
      ingredient_id: ingredientId,
      source: 'leftover',
      quantity: 1,
      unit: 'tbsp',
      expiration_date: TOMORROW_YMD,
      created_by: creatorMemberId,
    })

    // Act
    await expireLeftovers({
      supabase: fixture.supabase,
      workspaceId: fixture.workspaceId,
      todayYmd: TODAY_YMD,
    })

    // Assert — still active
    const after = await listInventoryItems({
      supabase: fixture.supabase,
      workspaceId: fixture.workspaceId,
    })
    const row = after.find((i) => i.id === itemId)
    expect(row).toBeDefined()
    expect(row?.is_consumed).toBe(false)

    // Cleanup
    await fixture.supabase.from('inventory_items').delete().eq('id', itemId)
    sweepItemIds = sweepItemIds.filter((id) => id !== itemId)
  })

  // -------------------------------------------------------------------------
  // 5. leftover row with NULL expiration_date → NOT expired
  // -------------------------------------------------------------------------
  it('does NOT expire a leftover row with a NULL expiration_date', async () => {
    // Arrange
    const itemId = await createAndTrack({
      ingredient_id: ingredientId,
      source: 'leftover',
      quantity: 2,
      unit: 'ml',
      expiration_date: null,
      created_by: creatorMemberId,
    })

    // Act
    await expireLeftovers({
      supabase: fixture.supabase,
      workspaceId: fixture.workspaceId,
      todayYmd: TODAY_YMD,
    })

    // Assert — still active (NULL expiration_date is excluded by the .not('expiration_date','is',null) clause)
    const after = await listInventoryItems({
      supabase: fixture.supabase,
      workspaceId: fixture.workspaceId,
    })
    const row = after.find((i) => i.id === itemId)
    expect(row).toBeDefined()
    expect(row?.is_consumed).toBe(false)

    // Cleanup
    await fixture.supabase.from('inventory_items').delete().eq('id', itemId)
    sweepItemIds = sweepItemIds.filter((id) => id !== itemId)
  })

  // -------------------------------------------------------------------------
  // 6. expiredCount matches the number of rows actually expired
  // -------------------------------------------------------------------------
  it('returns { expiredCount } equal to the number of rows expired in the call', async () => {
    // Arrange — create exactly 3 rows that should expire + 1 that should not,
    // all scoped to a fresh isolated workspace to ensure a deterministic count.
    //
    // Because this fixture's workspace is shared across tests, create a fresh
    // workspace here to avoid interference from rows created in other tests
    // that have already been expired and set is_consumed=true.

    // Create a second fixture with its own workspace.
    const { createIntegrationFixture: createFix } = await import(
      '@weekly-food-planner/test-utils'
    )
    const isoFixture = await createFix()

    // Seed ingredient in the isolated workspace context (same ingredient, catalog-wide).
    // workspace_members.id in the isolated fixture
    const { data: isoMember, error: isoMemErr } = await isoFixture.supabase
      .from('workspace_members')
      .select('id')
      .eq('workspace_id', isoFixture.workspaceId)
      .eq('user_id', isoFixture.userId)
      .eq('is_deleted', false)
      .maybeSingle()
    if (isoMemErr || !isoMember) {
      await isoFixture.cleanup()
      throw new Error(`iso member row not found: ${isoMemErr?.message ?? 'no row'}`)
    }
    const isoMemberId = (isoMember as { id: string }).id

    const isoItemIds: string[] = []
    const seedItem = async (source: 'leftover' | 'cook_remainder' | 'manual', expDate: string | null) => {
      const { data: row, error } = await isoFixture.supabase
        .from('inventory_items')
        .insert({
          workspace_id: isoFixture.workspaceId,
          ingredient_id: ingredientId,
          source,
          quantity: 1,
          unit: 'piece',
          is_consumed: false,
          expiration_date: expDate,
          created_by: isoMemberId,
        })
        .select('id')
        .single()
      if (error || !row) throw new Error(`iso item seed failed: ${error?.message ?? 'no row'}`)
      isoItemIds.push((row as { id: string }).id)
    }

    try {
      // Should expire (leftover, past)
      await seedItem('leftover', YESTERDAY_YMD)
      // Should expire (cook_remainder, past)
      await seedItem('cook_remainder', PAST_YMD)
      // Should expire (leftover, well in the past)
      await seedItem('leftover', PAST_YMD)
      // Should NOT expire (leftover, future)
      await seedItem('leftover', TOMORROW_YMD)
      // Should NOT expire (manual, past — manual is exempt)
      await seedItem('manual', YESTERDAY_YMD)

      // Act
      const { expiredCount } = await expireLeftovers({
        supabase: isoFixture.supabase,
        workspaceId: isoFixture.workspaceId,
        todayYmd: TODAY_YMD,
      })

      // Assert — exactly 3 rows expired
      expect(expiredCount).toBe(3)
    } finally {
      if (isoItemIds.length > 0) {
        await isoFixture.supabase.from('inventory_items').delete().in('id', isoItemIds)
      }
      await isoFixture.cleanup()
    }
  })
})
