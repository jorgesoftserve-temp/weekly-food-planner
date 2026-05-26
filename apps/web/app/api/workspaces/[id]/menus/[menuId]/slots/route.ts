import { type NextRequest } from 'next/server'
import {
  createFilterContext,
  isRecipeValidForSlot,
  type SlotSpec,
} from '@weekly-food-planner/constraint-engine'
import {
  getAuthenticatedUser,
  getWorkspaceRole,
  hasAdminRole,
} from '@/lib/api/auth-helpers'
import {
  badRequest,
  forbidden,
  jsonError,
  jsonOk,
  notFound,
  serverError,
  unauthorized,
} from '@/lib/api/responses'
import { loadEngineSnapshot } from '@/lib/api/menu-loader'
import { pickMealKey } from '@/lib/api/menu-slot-key'
import { supabaseAdminClient } from '@/utils/supabase/admin'

type RouteParams = { id: string; menuId: string }

const DAYS_OF_WEEK = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
] as const
const MEAL_TYPES = ['breakfast', 'lunch', 'dinner', 'snack'] as const

type DayOfWeek = (typeof DAYS_OF_WEEK)[number]
type MealType = (typeof MEAL_TYPES)[number]

type AddSlotBody = {
  dayOfWeek: DayOfWeek
  mealType: MealType
  recipeId: string
  targetMemberId: string | null
}

const isValidDay = (value: unknown): value is DayOfWeek =>
  typeof value === 'string' && (DAYS_OF_WEEK as readonly string[]).includes(value)

const isValidMealType = (value: unknown): value is MealType =>
  typeof value === 'string' && (MEAL_TYPES as readonly string[]).includes(value)

// POST adds a brand-new slot to an existing DRAFT menu. Created slots get
// is_overridden=false (the user picked them from the start — there's no
// engine-picked alternative to remember) and a NULL original_recipe_id.
// For weekly menus the engine re-validates hard constraints against the
// target member; custom menus skip the engine check since the user has
// already opted into managing their own constraint set.
export const POST = async (
  request: NextRequest,
  { params }: { params: Promise<RouteParams> },
) => {
  const { id: workspaceId, menuId } = await params
  const user = await getAuthenticatedUser()
  if (!user) return unauthorized()
  const role = await getWorkspaceRole({
    supabase: user.supabase,
    userId: user.id,
    workspaceId,
  })
  if (!hasAdminRole(role)) return forbidden()

  const raw = (await request.json().catch(() => null)) as Partial<AddSlotBody> | null
  if (!raw) return badRequest('invalid JSON body')
  if (!isValidDay(raw.dayOfWeek)) return badRequest('invalid dayOfWeek')
  if (!isValidMealType(raw.mealType)) return badRequest('invalid mealType')
  if (typeof raw.recipeId !== 'string' || raw.recipeId.length === 0) {
    return badRequest('recipeId is required')
  }
  const targetMemberId =
    raw.targetMemberId === undefined ? null : raw.targetMemberId
  if (targetMemberId !== null && typeof targetMemberId !== 'string') {
    return badRequest('targetMemberId must be a UUID or null')
  }

  const admin = supabaseAdminClient()

  const { data: menuRow, error: menuErr } = await admin
    .from('menus')
    .select(
      `id, workspace_id, is_deleted, accepted_at, menu_type, generation_options,
       menu_slots (day_of_week, meal_key, target_member_id),
       menu_participants (member_id)`,
    )
    .eq('id', menuId)
    .maybeSingle()
  if (menuErr) return serverError(menuErr.message)
  if (!menuRow) return notFound()
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
  const m = menuRow as MenuRow
  if (m.workspace_id !== workspaceId || m.is_deleted) return notFound()
  if (m.accepted_at !== null) {
    return jsonError(
      409,
      'menu_accepted',
      'This menu has already been accepted. Generate a new draft to add slots.',
    )
  }

  // Target member must be a participant of this menu — otherwise the user
  // could route a slot to someone the menu wasn't generated for, undoing
  // Phase 2's participant boundary.
  if (targetMemberId !== null) {
    const participantIds = new Set(m.menu_participants.map((p) => p.member_id))
    if (!participantIds.has(targetMemberId)) {
      return jsonError(
        422,
        'not_a_participant',
        'That member is not a participant of this menu.',
      )
    }
  }

  // Verify the recipe belongs to this workspace and its meal_type matches.
  const { data: recipeRow, error: recipeErr } = await admin
    .from('recipes')
    .select('id, meal_type, is_deleted, workspace_id')
    .eq('id', raw.recipeId)
    .maybeSingle()
  if (recipeErr) return serverError(recipeErr.message)
  if (!recipeRow) return badRequest('recipe not found in this workspace')
  type RecipeRow = {
    id: string
    meal_type: MealType
    is_deleted: boolean
    workspace_id: string
  }
  const recipe = recipeRow as RecipeRow
  if (recipe.workspace_id !== workspaceId || recipe.is_deleted) {
    return badRequest('recipe not found in this workspace')
  }
  if (recipe.meal_type !== raw.mealType) {
    return jsonError(
      422,
      'meal_type_mismatch',
      `Recipe is a ${recipe.meal_type} recipe; slot expected ${raw.mealType}.`,
    )
  }

  // Hard-constraint validation — only for weekly menus. Custom menus opt
  // out of engine validation by design (the user is managing constraints
  // themselves).
  if (m.menu_type === 'weekly') {
    const snapshot = await loadEngineSnapshot({
      supabase: user.supabase,
      workspaceId,
    })
    if (!snapshot.ok) return serverError(snapshot.detail ?? 'snapshot load failed')
    const candidate = snapshot.recipes.find((r) => r.id === raw.recipeId)
    if (!candidate) {
      return badRequest('recipe not found in this workspace')
    }
    const targetMember = targetMemberId
      ? snapshot.members.find((mem) => mem.id === targetMemberId)
      : snapshot.members[0]
    if (!targetMember) {
      return serverError('cannot resolve a member to validate against')
    }
    const overlay = (m.generation_options ?? undefined) as
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
      dayOfWeek: raw.dayOfWeek as SlotSpec['dayOfWeek'],
      mealKey: raw.mealType,
      mealType: raw.mealType,
      targetMemberId: targetMemberId ?? targetMember.id,
    }
    if (!isRecipeValidForSlot({ recipe: candidate, slot: slotSpec, ctx })) {
      return jsonError(
        422,
        'constraint_violation',
        'That recipe violates a hard constraint for this slot (allergy, dietary restriction, ingredient exclusion, or meal type mismatch).',
      )
    }
  }

  // Pick a meal_key that doesn't collide with an existing slot in the same
  // (day, target_member_id) bucket. The unique constraint on
  // (menu_id, day_of_week, meal_key, target_member_id) is NULLS NOT
  // DISTINCT, so null target_member_id slots collide with each other on
  // meal_key — derive against that bucket too.
  const existingKeys = m.menu_slots
    .filter(
      (s) =>
        s.day_of_week === raw.dayOfWeek &&
        s.target_member_id === targetMemberId,
    )
    .map((s) => s.meal_key)
  let mealKey: string
  try {
    mealKey = pickMealKey({ mealType: raw.mealType, existingKeys })
  } catch (err) {
    return jsonError(
      422,
      'too_many_meals',
      err instanceof Error ? err.message : 'too many meals for this day',
    )
  }

  const { data: inserted, error: insErr } = await admin
    .from('menu_slots')
    .insert({
      menu_id: menuId,
      day_of_week: raw.dayOfWeek,
      meal_key: mealKey,
      meal_type: raw.mealType,
      recipe_id: raw.recipeId,
      target_member_id: targetMemberId,
      // is_overridden stays false: the user added this slot from scratch.
      // It's not an override of an engine pick.
    })
    .select('id, day_of_week, meal_key, meal_type, recipe_id, target_member_id, is_overridden, original_recipe_id')
    .single()
  if (insErr || !inserted) {
    return serverError(insErr?.message ?? 'slot insert failed')
  }

  return jsonOk({ ok: true, slot: inserted }, { status: 201 })
}
