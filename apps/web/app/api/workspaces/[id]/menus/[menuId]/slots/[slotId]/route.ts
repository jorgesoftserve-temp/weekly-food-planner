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
import { supabaseAdminClient } from '@/utils/supabase/admin'

type RouteParams = { id: string; menuId: string; slotId: string }

type ReplaceBody = { action: 'replace'; recipeId: string }

// PATCH replaces the recipe assigned to a single slot in a DRAFT menu.
// Validates the new recipe passes the engine's hard-constraint filter for
// the slot before persisting. Marks the slot as overridden and preserves
// the engine's original recipe_id for history.
export const PATCH = async (
  request: NextRequest,
  { params }: { params: Promise<RouteParams> },
) => {
  const { id: workspaceId, menuId, slotId } = await params
  const user = await getAuthenticatedUser()
  if (!user) return unauthorized()
  const role = await getWorkspaceRole({
    supabase: user.supabase,
    userId: user.id,
    workspaceId,
  })
  if (!hasAdminRole(role)) return forbidden()

  const body = (await request.json().catch(() => null)) as ReplaceBody | null
  if (!body || body.action !== 'replace' || !body.recipeId) {
    return badRequest('expected { action: "replace", recipeId: string }')
  }

  const admin = supabaseAdminClient()

  const { data: menuRow, error: menuErr } = await admin
    .from('menus')
    .select(
      `id, workspace_id, is_deleted, accepted_at, generation_options,
       menu_slots!inner (id, day_of_week, meal_key, meal_type, target_member_id, recipe_id, is_overridden, original_recipe_id)`,
    )
    .eq('id', menuId)
    .eq('menu_slots.id', slotId)
    .maybeSingle()
  if (menuErr) return serverError(menuErr.message)
  if (!menuRow) return notFound()
  type MenuRow = {
    id: string
    workspace_id: string
    is_deleted: boolean
    accepted_at: string | null
    generation_options: unknown
    menu_slots: Array<{
      id: string
      day_of_week: string
      meal_key: string
      meal_type: 'breakfast' | 'lunch' | 'dinner' | 'snack'
      target_member_id: string | null
      recipe_id: string
      is_overridden: boolean
      original_recipe_id: string | null
    }>
  }
  const m = menuRow as MenuRow
  if (m.workspace_id !== workspaceId || m.is_deleted) return notFound()
  if (m.accepted_at !== null) {
    return jsonError(
      409,
      'menu_accepted',
      'This menu has already been accepted. Generate a new draft to make changes.',
    )
  }
  const slot = m.menu_slots[0]
  if (!slot) return notFound()

  // Validate hard constraints — same logic the engine uses during generation.
  const snapshot = await loadEngineSnapshot({
    supabase: user.supabase,
    workspaceId,
  })
  if (!snapshot.ok) return serverError(snapshot.detail ?? 'snapshot load failed')

  const candidate = snapshot.recipes.find((r) => r.id === body.recipeId)
  if (!candidate) {
    return badRequest('recipe not found in this workspace')
  }
  const targetMember = slot.target_member_id
    ? snapshot.members.find((mem) => mem.id === slot.target_member_id)
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
    dayOfWeek: slot.day_of_week as SlotSpec['dayOfWeek'],
    mealKey: slot.meal_key,
    mealType: slot.meal_type,
    // The engine's SlotSpec models targetMemberId as non-null because every
    // engine-generated slot is per-member. DB rows can be NULL for shared
    // slots; we validate against the resolved targetMember.id in that case.
    targetMemberId: slot.target_member_id ?? targetMember.id,
  }
  if (!isRecipeValidForSlot({ recipe: candidate, slot: slotSpec, ctx })) {
    return jsonError(
      422,
      'constraint_violation',
      'That recipe violates a hard constraint for this slot (allergy, dietary restriction, ingredient exclusion, or meal type mismatch).',
    )
  }

  // Same recipe? No-op — return current shape with 200.
  if (slot.recipe_id === body.recipeId && !slot.is_overridden) {
    return jsonOk({ ok: true, slot, unchanged: true })
  }

  const { error: updErr } = await admin
    .from('menu_slots')
    .update({
      recipe_id: body.recipeId,
      is_overridden: true,
      // Preserve the engine's original pick the first time the user
      // overrides this slot. Subsequent re-replacements don't touch it.
      original_recipe_id: slot.original_recipe_id ?? slot.recipe_id,
    })
    .eq('id', slotId)
  if (updErr) return serverError(updErr.message)

  return jsonOk({
    ok: true,
    slot: {
      ...slot,
      recipe_id: body.recipeId,
      is_overridden: true,
      original_recipe_id: slot.original_recipe_id ?? slot.recipe_id,
    },
  })
}
