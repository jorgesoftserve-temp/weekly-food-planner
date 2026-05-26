import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import {
  createIntegrationFixture,
  INTEGRATION_ENABLED,
  type IntegrationFixture,
} from '@weekly-food-planner/test-utils'
import {
  createMember,
  createRecipe,
  type IngredientRecord,
} from '@weekly-food-planner/supabase'
import {
  generateMenu,
  type GenerateMenuInput,
  type MealFrequencyEntry,
} from '@weekly-food-planner/constraint-engine'
import { loadEngineSnapshot } from '@/lib/api/menu-loader'
import { acceptDraftMenu } from '@/lib/api/menu-accept'
import { persistGeneratedMenu } from '@/lib/api/menu-persistence'
import { loadMenuExport } from '@/lib/api/menu-export-loader'
import { addSlotToDraftMenu } from '@/lib/api/menu-add-slot'

// 2 meals/day, 7 days → engine fills 14 slots per member.
const WEEKLY_FREQ: MealFrequencyEntry[] = [
  { key: 'breakfast', title: 'Breakfast', mealType: 'breakfast', defaultHour: 8 },
  { key: 'dinner', title: 'Dinner', mealType: 'dinner', defaultHour: 19 },
]

const WEEK_START = '2026-07-06' // Monday

type SeededIngredient = Pick<IngredientRecord, 'id' | 'name'>

const seedIngredients = async (
  fixture: IntegrationFixture,
): Promise<SeededIngredient[]> => {
  const { data, error } = await fixture.supabase
    .from('ingredients')
    .insert([
      { name: 'Oats', is_perishable: false, max_storage_days: null },
      { name: 'Milk', is_perishable: true, max_storage_days: 7 },
      { name: 'Pasta', is_perishable: false, max_storage_days: null },
      { name: 'Tomato', is_perishable: true, max_storage_days: 7 },
      { name: 'Apple', is_perishable: true, max_storage_days: 7 },
    ])
    .select('id, name')
  if (error || !data) throw new Error(`seed ingredients failed: ${error?.message}`)
  return data as SeededIngredient[]
}

describe.skipIf(!INTEGRATION_ENABLED)('mvp1.5 follow-ups (integration)', () => {
  let fixture: IntegrationFixture
  let ingredients: SeededIngredient[]
  let secondMemberId: string
  let breakfastRecipeId: string
  let snackRecipeId: string

  beforeAll(async () => {
    fixture = await createIntegrationFixture()
    // Signup trigger inserted one creator member. Add a second so we can
    // exercise per-member shop-for filtering.
    const second = await createMember({
      supabase: fixture.supabase,
      workspaceId: fixture.workspaceId,
      payload: {
        name: 'Bob',
        role: 'member',
        age_category: 'adult',
      },
    })
    secondMemberId = second.id

    // Workspace needs a shared_meal_frequency or the engine refuses with
    // NO_SLOTS. The signup trigger leaves it NULL.
    const { error: wsUpdateErr } = await fixture.supabase
      .from('workspaces')
      .update({ shared_meal_frequency: WEEKLY_FREQ })
      .eq('id', fixture.workspaceId)
    if (wsUpdateErr) throw new Error(`set shared_meal_frequency: ${wsUpdateErr.message}`)

    ingredients = await seedIngredients(fixture)
    const oats = ingredients.find((i) => i.name === 'Oats')!
    const milk = ingredients.find((i) => i.name === 'Milk')!
    const pasta = ingredients.find((i) => i.name === 'Pasta')!
    const tomato = ingredients.find((i) => i.name === 'Tomato')!
    const apple = ingredients.find((i) => i.name === 'Apple')!

    const breakfast = await createRecipe({
      supabase: fixture.supabase,
      workspaceId: fixture.workspaceId,
      payload: {
        name: 'Oatmeal',
        meal_type: 'breakfast',
        difficulty: 'easy',
        servings: 1,
        ingredients: [
          { ingredient_id: oats.id, quantity: 0.5, unit: 'cup' },
          { ingredient_id: milk.id, quantity: 1, unit: 'cup' },
        ],
      },
    })
    breakfastRecipeId = breakfast.id

    await createRecipe({
      supabase: fixture.supabase,
      workspaceId: fixture.workspaceId,
      payload: {
        name: 'Tomato pasta',
        meal_type: 'dinner',
        difficulty: 'easy',
        servings: 2,
        ingredients: [
          { ingredient_id: pasta.id, quantity: 200, unit: 'g' },
          { ingredient_id: tomato.id, quantity: 3, unit: 'piece' },
        ],
      },
    })

    const snack = await createRecipe({
      supabase: fixture.supabase,
      workspaceId: fixture.workspaceId,
      payload: {
        name: 'Apple slice',
        meal_type: 'snack',
        difficulty: 'easy',
        servings: 1,
        ingredients: [{ ingredient_id: apple.id, quantity: 1, unit: 'piece' }],
      },
    })
    snackRecipeId = snack.id
  })

  afterAll(async () => {
    await fixture?.cleanup()
  })

  const generateDraft = async (): Promise<{
    menuId: string
    members: string[]
  }> => {
    const loaded = await loadEngineSnapshot({
      supabase: fixture.supabase,
      workspaceId: fixture.workspaceId,
    })
    if (!loaded.ok) throw new Error(`loadEngineSnapshot: ${loaded.reason}`)
    const input: GenerateMenuInput = {
      workspace: loaded.workspace,
      members: loaded.members,
      recipes: loaded.recipes,
      ingredients: loaded.ingredients,
      weekStartDate: WEEK_START,
      seed: 42,
    }
    const result = await generateMenu(input)
    if (!result.ok) throw new Error(`generateMenu: ${result.error.reasonCode}`)
    const memberIds = loaded.members.map((m) => m.id)
    const persisted = await persistGeneratedMenu({
      admin: fixture.supabase,
      workspaceId: fixture.workspaceId,
      weekStartDate: WEEK_START,
      input,
      result,
      participantMemberIds: memberIds,
    })
    if (!persisted.ok) {
      throw new Error(`persistGeneratedMenu: ${persisted.detail}`)
    }
    if (!persisted.menuId) throw new Error('persistGeneratedMenu: no menuId')
    return { menuId: persisted.menuId, members: memberIds }
  }

  const deleteMenu = async (menuId: string): Promise<void> => {
    // Tests share a workspace, so wipe state between scenarios. is_deleted
    // is enough for the loaders to ignore it.
    await fixture.supabase
      .from('menus')
      .update({ is_deleted: true })
      .eq('id', menuId)
  }

  describe('addSlotToDraftMenu', () => {
    it('adds a snack slot to a draft menu and returns the inserted row', async () => {
      const { menuId, members } = await generateDraft()
      const result = await addSlotToDraftMenu({
        admin: fixture.supabase,
        supabase: fixture.supabase,
        workspaceId: fixture.workspaceId,
        menuId,
        body: {
          dayOfWeek: 'monday',
          mealType: 'snack',
          recipeId: snackRecipeId,
          targetMemberId: members[0] ?? null,
        },
      })
      expect(result.ok).toBe(true)
      if (!result.ok) return
      expect(result.slot.day_of_week).toBe('monday')
      expect(result.slot.meal_type).toBe('snack')
      expect(result.slot.recipe_id).toBe(snackRecipeId)
      expect(result.slot.is_overridden).toBe(false)
      expect(result.slot.original_recipe_id).toBeNull()
      await deleteMenu(menuId)
    })

    it('refuses to add a slot once the menu has been accepted', async () => {
      const { menuId, members } = await generateDraft()
      const accepted = await acceptDraftMenu({
        admin: fixture.supabase,
        workspaceId: fixture.workspaceId,
        menuId,
      })
      if (!accepted.ok) throw new Error(`acceptDraftMenu: ${accepted.detail}`)
      const result = await addSlotToDraftMenu({
        admin: fixture.supabase,
        supabase: fixture.supabase,
        workspaceId: fixture.workspaceId,
        menuId,
        body: {
          dayOfWeek: 'tuesday',
          mealType: 'snack',
          recipeId: snackRecipeId,
          targetMemberId: members[0] ?? null,
        },
      })
      expect(result.ok).toBe(false)
      if (result.ok) return
      expect(result.reason).toBe('menu_accepted')
      await deleteMenu(menuId)
    })

    it('refuses a member that is not a participant of this menu', async () => {
      // Persist a menu with ONLY the creator member as a participant. Then
      // try to target the second member that exists in the workspace.
      const loaded = await loadEngineSnapshot({
        supabase: fixture.supabase,
        workspaceId: fixture.workspaceId,
      })
      if (!loaded.ok) throw new Error(loaded.reason)
      const creatorOnly = loaded.members.filter((m) => m.id !== secondMemberId)
      const input: GenerateMenuInput = {
        workspace: loaded.workspace,
        members: creatorOnly,
        recipes: loaded.recipes,
        ingredients: loaded.ingredients,
        weekStartDate: '2026-07-13',
        seed: 99,
      }
      const result = await generateMenu(input)
      if (!result.ok) throw new Error(result.error.reasonCode)
      const persisted = await persistGeneratedMenu({
        admin: fixture.supabase,
        workspaceId: fixture.workspaceId,
        weekStartDate: '2026-07-13',
        input,
        result,
        participantMemberIds: creatorOnly.map((m) => m.id),
      })
      if (!persisted.ok || !persisted.menuId) throw new Error('persist failed')

      const addResult = await addSlotToDraftMenu({
        admin: fixture.supabase,
        supabase: fixture.supabase,
        workspaceId: fixture.workspaceId,
        menuId: persisted.menuId,
        body: {
          dayOfWeek: 'wednesday',
          mealType: 'snack',
          recipeId: snackRecipeId,
          targetMemberId: secondMemberId,
        },
      })
      expect(addResult.ok).toBe(false)
      if (addResult.ok) return
      expect(addResult.reason).toBe('not_a_participant')
      await deleteMenu(persisted.menuId)
    })

    it('refuses a recipe whose meal_type does not match the slot', async () => {
      const { menuId, members } = await generateDraft()
      const result = await addSlotToDraftMenu({
        admin: fixture.supabase,
        supabase: fixture.supabase,
        workspaceId: fixture.workspaceId,
        menuId,
        body: {
          dayOfWeek: 'thursday',
          mealType: 'dinner',
          recipeId: breakfastRecipeId, // breakfast recipe → dinner slot
          targetMemberId: members[0] ?? null,
        },
      })
      expect(result.ok).toBe(false)
      if (result.ok) return
      expect(result.reason).toBe('meal_type_mismatch')
      await deleteMenu(menuId)
    })

    it('refuses a recipe that does not belong to this workspace', async () => {
      const { menuId, members } = await generateDraft()
      const result = await addSlotToDraftMenu({
        admin: fixture.supabase,
        supabase: fixture.supabase,
        workspaceId: fixture.workspaceId,
        menuId,
        body: {
          dayOfWeek: 'friday',
          mealType: 'snack',
          recipeId: '00000000-0000-0000-0000-000000000000',
          targetMemberId: members[0] ?? null,
        },
      })
      expect(result.ok).toBe(false)
      if (result.ok) return
      expect(result.reason).toBe('recipe_not_in_workspace')
      await deleteMenu(menuId)
    })
  })

  describe('loadMenuExport with shopForIds', () => {
    it('scales the shared bucket and filters per-member buckets when a subset is selected', async () => {
      // Generate + accept a menu with BOTH members as participants. The
      // engine emits per-member slots so the persisted grocery list has a
      // shared bucket + one bucket per member.
      const { menuId, members } = await generateDraft()
      const accepted = await acceptDraftMenu({
        admin: fixture.supabase,
        workspaceId: fixture.workspaceId,
        menuId,
      })
      if (!accepted.ok) throw new Error(accepted.detail)

      const full = await loadMenuExport({
        supabase: fixture.supabase,
        workspaceId: fixture.workspaceId,
        weekStartDate: WEEK_START,
      })
      if (!full.ok) throw new Error(`full export: ${full.reason}`)
      const fullShared = full.export.groceryLists.find((l) => l.targetMemberId === null)
      const fullPerMemberCount = full.export.groceryLists.filter(
        (l) => l.targetMemberId !== null,
      ).length
      expect(fullShared).toBeDefined()
      expect(fullPerMemberCount).toBe(2)

      const filtered = await loadMenuExport({
        supabase: fixture.supabase,
        workspaceId: fixture.workspaceId,
        weekStartDate: WEEK_START,
        shopForIds: members[0] ? [members[0]] : null,
      })
      if (!filtered.ok) throw new Error(`filtered export: ${filtered.reason}`)
      const filteredShared = filtered.export.groceryLists.find(
        (l) => l.targetMemberId === null,
      )
      const filteredPerMemberCount = filtered.export.groceryLists.filter(
        (l) => l.targetMemberId !== null,
      ).length
      expect(filteredShared).toBeDefined()
      // 2 participants → 1 selected → shared scaled by 1/2.
      const fullFirst = fullShared?.items[0]?.quantity ?? 0
      const filteredFirst = filteredShared?.items[0]?.quantity ?? 0
      expect(filteredFirst).toBeCloseTo(fullFirst / 2, 6)
      // Only the selected member's bucket remains.
      expect(filteredPerMemberCount).toBe(1)
      expect(filtered.export.groceryLists.find((l) => l.targetMemberId === members[0])).toBeDefined()

      await deleteMenu(menuId)
    })

    it('returns the full unfiltered list when shopForIds is null', async () => {
      const { menuId } = await generateDraft()
      const accepted = await acceptDraftMenu({
        admin: fixture.supabase,
        workspaceId: fixture.workspaceId,
        menuId,
      })
      if (!accepted.ok) throw new Error(accepted.detail)

      const result = await loadMenuExport({
        supabase: fixture.supabase,
        workspaceId: fixture.workspaceId,
        weekStartDate: WEEK_START,
        shopForIds: null,
      })
      if (!result.ok) throw new Error(result.reason)
      // 1 shared + 2 per-member = 3 lists for a 2-participant menu.
      expect(result.export.groceryLists).toHaveLength(3)
      await deleteMenu(menuId)
    })
  })
})
