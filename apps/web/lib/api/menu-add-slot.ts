import type { SupabaseClient } from '@supabase/supabase-js'
import {
  createFilterContext,
  isRecipeValidForSlot,
  type SlotSpec,
} from '@weekly-food-planner/constraint-engine'
import { loadEngineSnapshot } from './menu-loader'
import { pickMealKey } from './menu-slot-key'

export const DAYS_OF_WEEK = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
] as const
export const MEAL_TYPES = ['breakfast', 'lunch', 'dinner', 'snack'] as const

export type DayOfWeek = (typeof DAYS_OF_WEEK)[number]
export type MealType = (typeof MEAL_TYPES)[number]

export type AddSlotBody = {
  dayOfWeek: DayOfWeek
  mealType: MealType
  recipeId: string
  targetMemberId: string | null
}

export type InsertedSlot = {
  id: string
  day_of_week: string
  meal_key: string
  meal_type: MealType
  recipe_id: string
  target_member_id: string | null
  is_overridden: boolean
  original_recipe_id: string | null
}

export type AddSlotReason =
  | 'not_found'
  | 'menu_accepted'
  | 'not_a_participant'
  | 'recipe_not_in_workspace'
  | 'meal_type_mismatch'
  | 'constraint_violation'
  | 'too_many_meals'
  | 'snapshot_load_failed'
  | 'db_error'

export type AddSlotResult =
  | { ok: true; slot: InsertedSlot }
  | { ok: false; reason: AddSlotReason; detail?: string }

type MenuRow = {
  id: string
  workspace_id: string
  is_deleted: boolean
  accepted_at: string | null
  menu_type: 'weekly' | 'custom'
  generation_options: unknown
  menu_slots: Array<{
    day_of_week: string
    meal_key: string
    target_member_id: string | null
  }>
  menu_participants: Array<{ member_id: string }>
}

type RecipeRow = {
  id: string
  meal_type: MealType
  is_deleted: boolean
  workspace_id: string
}

// Adds a brand-new slot to an existing DRAFT menu. Created slots get
// is_overridden=false (the user picked them from the start — there's no
// engine-picked alternative to remember) and a NULL original_recipe_id.
// For weekly menus the engine re-validates hard constraints against the
// target member; custom menus skip the engine check since the user has
// already opted into managing their own constraint set.
//
// Returns a structured Result so the route handler can map reasons to
// HTTP status codes and integration tests can assert on the same reasons
// without going through HTTP.
export const addSlotToDraftMenu = async ({
  admin,
  supabase,
  workspaceId,
  menuId,
  body,
}: {
  admin: SupabaseClient
  supabase: SupabaseClient
  workspaceId: string
  menuId: string
  body: AddSlotBody
}): Promise<AddSlotResult> => {
  const targetMemberId = body.targetMemberId

  const { data: menuRow, error: menuErr } = await admin
    .from('menus')
    .select(
      `id, workspace_id, is_deleted, accepted_at, menu_type, generation_options,
       menu_slots (day_of_week, meal_key, target_member_id),
       menu_participants (member_id)`,
    )
    .eq('id', menuId)
    .maybeSingle()
  if (menuErr) return { ok: false, reason: 'db_error', detail: menuErr.message }
  if (!menuRow) return { ok: false, reason: 'not_found' }
  const menu = menuRow as MenuRow
  if (menu.workspace_id !== workspaceId || menu.is_deleted) {
    return { ok: false, reason: 'not_found' }
  }
  if (menu.accepted_at !== null) {
    return {
      ok: false,
      reason: 'menu_accepted',
      detail: 'This menu has already been accepted. Generate a new draft to add slots.',
    }
  }

  // Target member must be a participant of this menu — otherwise the user
  // could route a slot to someone the menu wasn't generated for, undoing
  // Phase 2's participant boundary.
  if (targetMemberId !== null) {
    const participantIds = new Set(menu.menu_participants.map((p) => p.member_id))
    if (!participantIds.has(targetMemberId)) {
      return {
        ok: false,
        reason: 'not_a_participant',
        detail: 'That member is not a participant of this menu.',
      }
    }
  }

  // Verify the recipe belongs to this workspace and its meal_type matches.
  const { data: recipeRow, error: recipeErr } = await admin
    .from('recipes')
    .select('id, meal_type, is_deleted, workspace_id')
    .eq('id', body.recipeId)
    .maybeSingle()
  if (recipeErr) return { ok: false, reason: 'db_error', detail: recipeErr.message }
  if (!recipeRow) return { ok: false, reason: 'recipe_not_in_workspace' }
  const recipe = recipeRow as RecipeRow
  if (recipe.workspace_id !== workspaceId || recipe.is_deleted) {
    return { ok: false, reason: 'recipe_not_in_workspace' }
  }
  if (recipe.meal_type !== body.mealType) {
    return {
      ok: false,
      reason: 'meal_type_mismatch',
      detail: `Recipe is a ${recipe.meal_type} recipe; slot expected ${body.mealType}.`,
    }
  }

  // Hard-constraint validation — only for weekly menus. Custom menus opt
  // out of engine validation by design (the user is managing constraints
  // themselves).
  if (menu.menu_type === 'weekly') {
    const snapshot = await loadEngineSnapshot({ supabase, workspaceId })
    if (!snapshot.ok) {
      return {
        ok: false,
        reason: 'snapshot_load_failed',
        detail: snapshot.detail ?? 'snapshot load failed',
      }
    }
    const candidate = snapshot.recipes.find((r) => r.id === body.recipeId)
    if (!candidate) {
      return { ok: false, reason: 'recipe_not_in_workspace' }
    }
    const targetMember = targetMemberId
      ? snapshot.members.find((mem) => mem.id === targetMemberId)
      : snapshot.members[0]
    if (!targetMember) {
      return {
        ok: false,
        reason: 'snapshot_load_failed',
        detail: 'cannot resolve a member to validate against',
      }
    }
    const overlay = (menu.generation_options ?? undefined) as
      | {
          ingredientExclusions?: string[]
          additionalDietaryRestrictions?: string[]
          additionalAllergies?: string[]
        }
      | undefined
    const ctx = createFilterContext({
      member: targetMember,
      options: overlay,
      ingredients: snapshot.ingredients,
    })
    const slotSpec: SlotSpec = {
      dayOfWeek: body.dayOfWeek as SlotSpec['dayOfWeek'],
      mealKey: body.mealType,
      mealType: body.mealType,
      targetMemberId: targetMemberId ?? targetMember.id,
    }
    if (!isRecipeValidForSlot({ recipe: candidate, slot: slotSpec, ctx })) {
      return {
        ok: false,
        reason: 'constraint_violation',
        detail:
          'That recipe violates a hard constraint for this slot (allergy, dietary restriction, ingredient exclusion, or meal type mismatch).',
      }
    }
  }

  // Pick a meal_key that doesn't collide with an existing slot in the same
  // (day, target_member_id) bucket. The unique constraint on
  // (menu_id, day_of_week, meal_key, target_member_id) is NULLS NOT
  // DISTINCT, so null target_member_id slots collide with each other on
  // meal_key — derive against that bucket too.
  const existingKeys = menu.menu_slots
    .filter(
      (s) =>
        s.day_of_week === body.dayOfWeek && s.target_member_id === targetMemberId,
    )
    .map((s) => s.meal_key)
  let mealKey: string
  try {
    mealKey = pickMealKey({ mealType: body.mealType, existingKeys })
  } catch (err) {
    return {
      ok: false,
      reason: 'too_many_meals',
      detail: err instanceof Error ? err.message : 'too many meals for this day',
    }
  }

  const { data: inserted, error: insErr } = await admin
    .from('menu_slots')
    .insert({
      menu_id: menuId,
      day_of_week: body.dayOfWeek,
      meal_key: mealKey,
      meal_type: body.mealType,
      recipe_id: body.recipeId,
      target_member_id: targetMemberId,
    })
    .select(
      'id, day_of_week, meal_key, meal_type, recipe_id, target_member_id, is_overridden, original_recipe_id',
    )
    .single()
  if (insErr || !inserted) {
    return {
      ok: false,
      reason: 'db_error',
      detail: insErr?.message ?? 'slot insert failed',
    }
  }
  return { ok: true, slot: inserted as InsertedSlot }
}

export const isValidDay = (value: unknown): value is DayOfWeek =>
  typeof value === 'string' && (DAYS_OF_WEEK as readonly string[]).includes(value)

export const isValidMealType = (value: unknown): value is MealType =>
  typeof value === 'string' && (MEAL_TYPES as readonly string[]).includes(value)
