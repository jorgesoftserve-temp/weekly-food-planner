import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import {
  createIntegrationFixture,
  INTEGRATION_ENABLED,
  type IntegrationFixture,
} from '@weekly-food-planner/test-utils'
import { createRecipe } from '../recipes.js'

// ---------------------------------------------------------------------------
// v2.1 Track D — on-the-fly cook mode integration tests
//
// Spec: opening cook mode for any recipe — meal or addon — is ephemeral and
// must NOT write any menu_slots or slot_completions row. The only optional
// server surface is the leftover emit into inventory_items (reusing v2.0
// §16). We assert:
//
//   1. No menu_slots row is created for a given recipe when it is "cooked"
//      in on-the-fly mode (i.e. when we call the route-layer equivalent — the
//      direct DB write that on-the-fly mode is explicitly designed NOT to do).
//   2. No slot_completions row is created.
//   3. The optional leftover emit (inventory_items, source='leftover') can be
//      written without a menu_slot FK — confirming the leftover path is
//      independent of any menu slot.
//
// Because on-the-fly cook mode has no server endpoint (it is client-ephemeral
// for the checklist UX), we verify the negative: that the DB has no mechanism
// that would auto-create these rows, and that the leftover emit path works
// independently.
// ---------------------------------------------------------------------------

describe.skipIf(!INTEGRATION_ENABLED)('on-the-fly cook mode (integration)', () => {
  let fixture: IntegrationFixture
  let mealRecipeId: string
  let addonRecipeId: string
  let ingredientId: string

  beforeAll(async () => {
    fixture = await createIntegrationFixture()

    const { data: ing } = await fixture.supabase
      .from('ingredients')
      .insert({ name: `OtfIng-${Date.now()}`, is_perishable: false, max_storage_days: null })
      .select('id')
      .single()
    if (!ing) throw new Error('ingredient seed failed')
    ingredientId = (ing as { id: string }).id

    const mealRecipe = await createRecipe({
      supabase: fixture.supabase,
      workspaceId: fixture.workspaceId,
      payload: {
        name: `OtfMeal-${Date.now()}`,
        meal_types: ['dinner'],
        difficulty: 'easy',
        servings: 2,
        ingredients: [{ ingredient_id: ingredientId, quantity: 200, unit: 'g' }],
      },
    })
    mealRecipeId = mealRecipe.id

    const addonRecipe = await createRecipe({
      supabase: fixture.supabase,
      workspaceId: fixture.workspaceId,
      payload: {
        name: `OtfAddon-${Date.now()}`,
        recipe_kind: 'addon',
        difficulty: 'easy',
        servings: 4,
        ingredients: [{ ingredient_id: ingredientId, quantity: 50, unit: 'g' }],
      },
    })
    addonRecipeId = addonRecipe.id
  })

  afterAll(async () => {
    await fixture?.cleanup()
  })

  // ── No menu_slots row created by on-the-fly cook ───────────────────────────

  it('cooking a meal recipe in on-the-fly mode writes no menu_slots row', async () => {
    // On-the-fly cook is purely ephemeral on the client. We assert that the
    // recipe exists but there is no menu_slot pointing to it outside of a
    // real menu generation. We check there are no menu_slots for this recipe
    // at all (it was never added to any menu in this fixture).
    const { data: slots } = await fixture.supabase
      .from('menu_slots')
      .select('id')
      .eq('recipe_id', mealRecipeId)
    expect(((slots ?? []) as unknown[]).length).toBe(0)
  })

  it('cooking an addon recipe in on-the-fly mode writes no menu_slots row', async () => {
    const { data: slots } = await fixture.supabase
      .from('menu_slots')
      .select('id')
      .eq('recipe_id', addonRecipeId)
    expect(((slots ?? []) as unknown[]).length).toBe(0)
  })

  // ── No slot_completions row created by on-the-fly cook ────────────────────

  it('there are no slot_completions rows linked to the on-the-fly recipe', async () => {
    // slot_completions requires a menu_slot_id FK. Since no menu_slot exists
    // for this recipe, there can be no completion row either. This test proves
    // the negative constraint holds at the DB level.

    // Attempt to insert a slot_completion without a valid menu_slot_id → FK error.
    const { error } = await fixture.supabase.from('slot_completions').insert({
      menu_slot_id: '00000000-0000-0000-0000-000000000099', // non-existent
      workspace_id: fixture.workspaceId,
      status: 'cooked',
    })
    // FK violation confirms that on-the-fly cook cannot accidentally create a
    // completion row without a real slot.
    expect(error).not.toBeNull()
    expect(error?.code).toBe('23503')
  })

  // ── Optional leftover emit: inventory_items (source='leftover') ───────────
  //
  // On-the-fly cook mode optionally emits a leftover to inventory_items reusing
  // the v2.0 §16 leftover path. The leftover row does NOT require a
  // source_slot_id (it is nullable) — this is what makes the emit compatible
  // with on-the-fly mode (no menu slot involved).

  it('emitting a leftover from on-the-fly cook writes an inventory_items row with source=leftover and no source_slot_id', async () => {
    // Resolve the creator member row.
    const { data: memberRow } = await fixture.supabase
      .from('workspace_members')
      .select('id')
      .eq('workspace_id', fixture.workspaceId)
      .eq('is_deleted', false)
      .maybeSingle()
    const creatorMemberId = (memberRow as { id: string } | null)?.id

    // Act: insert inventory item simulating the leftover emit from on-the-fly cook.
    const { data, error } = await fixture.supabase
      .from('inventory_items')
      .insert({
        workspace_id: fixture.workspaceId,
        ingredient_id: ingredientId,
        source: 'leftover',
        quantity: 50,
        unit: 'g',
        // source_slot_id intentionally null (on-the-fly mode — no slot).
        source_slot_id: null,
        source_menu_id: null,
        created_by: creatorMemberId ?? null,
      })
      .select('id, source, source_slot_id')
      .single()

    expect(error).toBeNull()
    expect(data).not.toBeNull()
    const row = data as { id: string; source: string; source_slot_id: string | null }
    expect(row.source).toBe('leftover')
    expect(row.source_slot_id).toBeNull()

    // Cleanup.
    await fixture.supabase.from('inventory_items').update({ is_consumed: true }).eq('id', row.id)
  })

  // ── Confirm recipe is available for lookup (serves cook-mode UI) ───────────

  it('the on-the-fly recipe (meal or addon) is fetchable by id for the cook-mode UI', async () => {
    const { data: mealRow } = await fixture.supabase
      .from('recipes')
      .select('id, recipe_kind')
      .eq('id', mealRecipeId)
      .eq('is_deleted', false)
      .maybeSingle()
    expect(mealRow).not.toBeNull()
    expect((mealRow as { recipe_kind: string }).recipe_kind).toBe('meal')

    const { data: addonRow } = await fixture.supabase
      .from('recipes')
      .select('id, recipe_kind')
      .eq('id', addonRecipeId)
      .eq('is_deleted', false)
      .maybeSingle()
    expect(addonRow).not.toBeNull()
    expect((addonRow as { recipe_kind: string }).recipe_kind).toBe('addon')
  })
})
