import { type NextRequest } from 'next/server'
import { z } from 'zod'
import {
  deleteMenuSlotIngredientOverride,
  upsertMenuSlotIngredientOverride,
} from '@weekly-food-planner/supabase'
import { getAuthenticatedUser, getWorkspaceRole } from '@/lib/api/auth-helpers'
import { loadEngineSnapshot } from '@/lib/api/menu-loader'
import { recomputeGroceryListsForMenu } from '@/lib/api/menu-grocery'
import {
  describeBlockers,
  validateSubstituteForSlot,
} from '@/lib/api/ingredient-substitution'
import { formatZodError } from '@/lib/api/inventory'
import {
  badRequest,
  forbidden,
  jsonError,
  jsonOk,
  serverError,
  unauthorized,
} from '@/lib/api/responses'
import { supabaseAdminClient } from '@/utils/supabase/admin'

// (v2.0 Phase 6) Menu-level ingredient substitution for an ACCEPTED-menu slot.
//   PUT    { original_ingredient_id, substitute_ingredient_id, quantity?, unit?, note? }
//   DELETE { original_ingredient_id }
//
// The substitute is validated against the slot's eater(s) — rejected (422) if it
// introduces an allergen or an excluded ingredient. On success the override is
// upserted and the menu's grocery lists are recomputed (the override is applied
// inside recomputeGroceryListsForMenu). The override is keyed by menu_slot_id, so
// the menu's accepted_seed / identity are untouched — v2.0 stays engine-free.

type RouteParams = { id: string; menuId: string; slotId: string }

const UNIT_VALUES = [
  'g', 'kg', 'ml', 'l', 'tsp', 'tbsp', 'cup', 'piece', 'slice', 'pinch',
  'clove', 'can', 'pack',
] as const

const putBodySchema = z.object({
  original_ingredient_id: z.string().uuid('original_ingredient_id must be a UUID'),
  substitute_ingredient_id: z.string().uuid('substitute_ingredient_id must be a UUID'),
  quantity: z.number().min(0, 'quantity must be >= 0').nullable().optional(),
  unit: z.enum(UNIT_VALUES).nullable().optional(),
  note: z.string().min(1).max(255).nullable().optional(),
})

const deleteBodySchema = z.object({
  original_ingredient_id: z.string().uuid('original_ingredient_id must be a UUID'),
})

type LoadedSlot = {
  workspaceId: string
  recipeId: string
  targetMemberId: string | null
  overlay: {
    ingredientExclusions?: string[]
    additionalDietaryRestrictions?: string[]
    additionalAllergies?: string[]
  } | undefined
}

// Shared guard: caller is an active member, slot belongs to this accepted menu.
const loadAcceptedSlot = async ({
  supabase,
  workspaceId,
  menuId,
  slotId,
}: {
  supabase: ReturnType<typeof supabaseAdminClient>
  workspaceId: string
  menuId: string
  slotId: string
}): Promise<
  | { ok: true; slot: LoadedSlot }
  | { ok: false; status: number; code: string; message: string }
> => {
  const { data: menuRow, error: menuErr } = await supabase
    .from('menus')
    .select(
      'id, workspace_id, is_deleted, accepted_at, generation_options, menu_slots!inner (id, recipe_id, target_member_id)',
    )
    .eq('id', menuId)
    .eq('menu_slots.id', slotId)
    .maybeSingle()
  if (menuErr) return { ok: false, status: 500, code: 'db_error', message: menuErr.message }
  if (!menuRow) return { ok: false, status: 404, code: 'not_found', message: 'slot not found' }
  const m = menuRow as {
    workspace_id: string
    is_deleted: boolean
    accepted_at: string | null
    generation_options: unknown
    menu_slots: Array<{ id: string; recipe_id: string; target_member_id: string | null }>
  }
  if (m.workspace_id !== workspaceId || m.is_deleted) {
    return { ok: false, status: 404, code: 'not_found', message: 'slot not found' }
  }
  if (m.accepted_at === null) {
    return {
      ok: false,
      status: 409,
      code: 'menu_not_accepted',
      message: 'You can only substitute ingredients on an accepted menu.',
    }
  }
  const slot = m.menu_slots[0]
  if (!slot) return { ok: false, status: 404, code: 'not_found', message: 'slot not found' }
  return {
    ok: true,
    slot: {
      workspaceId: m.workspace_id,
      recipeId: slot.recipe_id,
      targetMemberId: slot.target_member_id,
      overlay: (m.generation_options ?? undefined) as LoadedSlot['overlay'],
    },
  }
}

export const PUT = async (
  request: NextRequest,
  { params }: { params: Promise<RouteParams> },
) => {
  const { id: workspaceId, menuId, slotId } = await params
  const user = await getAuthenticatedUser()
  if (!user) return unauthorized()
  const role = await getWorkspaceRole({ supabase: user.supabase, userId: user.id, workspaceId })
  if (!role) return forbidden()

  const raw = await request.json().catch(() => null)
  const parsed = putBodySchema.safeParse(raw)
  if (!parsed.success) return badRequest(formatZodError(parsed.error))
  const body = parsed.data

  const admin = supabaseAdminClient()
  const loaded = await loadAcceptedSlot({ supabase: admin, workspaceId, menuId, slotId })
  if (!loaded.ok) return jsonError(loaded.status, loaded.code, loaded.message)

  // Validate the substitute against the slot's eater(s): the targeted member for
  // a per-member slot, or the whole household for a shared (NULL-target) slot.
  const snapshot = await loadEngineSnapshot({ supabase: user.supabase, workspaceId })
  if (!snapshot.ok) return serverError(snapshot.detail ?? 'snapshot load failed')
  const eaters = loaded.slot.targetMemberId
    ? snapshot.members.filter((mem) => mem.id === loaded.slot.targetMemberId)
    : snapshot.members
  const validation = validateSubstituteForSlot({
    substituteIngredientId: body.substitute_ingredient_id,
    eaters,
    ingredients: snapshot.ingredients,
    overlay: loaded.slot.overlay,
  })
  if (!validation.ok) {
    return jsonError(
      422,
      'substitute_violates_constraint',
      `That substitute ${describeBlockers(validation.blockers)}.`,
    )
  }

  // Resolve the caller's member row (created_by + the inventory-style row-owner gate).
  const { data: memberRow, error: memberErr } = await user.supabase
    .from('workspace_members')
    .select('id')
    .eq('workspace_id', workspaceId)
    .eq('user_id', user.id)
    .eq('is_deleted', false)
    .maybeSingle()
  if (memberErr) return serverError(memberErr.message)
  const memberId = (memberRow as { id: string } | null)?.id ?? null

  try {
    const override = await upsertMenuSlotIngredientOverride({
      supabase: user.supabase,
      payload: {
        menu_slot_id: slotId,
        workspace_id: workspaceId,
        original_ingredient_id: body.original_ingredient_id,
        substitute_ingredient_id: body.substitute_ingredient_id,
        quantity: body.quantity ?? null,
        unit: body.unit ?? null,
        note: body.note ?? null,
        created_by: memberId,
      },
    })
    // Re-aggregate the menu's grocery lists so the substitution is reflected.
    const recompute = await recomputeGroceryListsForMenu({ admin, menuId })
    if (!recompute.ok) return serverError(recompute.detail)
    return jsonOk({ override, recompute }, { status: 200 })
  } catch (err) {
    return serverError(err instanceof Error ? err.message : 'failed to substitute ingredient')
  }
}

export const DELETE = async (
  request: NextRequest,
  { params }: { params: Promise<RouteParams> },
) => {
  const { id: workspaceId, menuId, slotId } = await params
  const user = await getAuthenticatedUser()
  if (!user) return unauthorized()
  const role = await getWorkspaceRole({ supabase: user.supabase, userId: user.id, workspaceId })
  if (!role) return forbidden()

  const raw = await request.json().catch(() => null)
  const parsed = deleteBodySchema.safeParse(raw)
  if (!parsed.success) return badRequest(formatZodError(parsed.error))

  const admin = supabaseAdminClient()
  const loaded = await loadAcceptedSlot({ supabase: admin, workspaceId, menuId, slotId })
  if (!loaded.ok) return jsonError(loaded.status, loaded.code, loaded.message)

  try {
    await deleteMenuSlotIngredientOverride({
      supabase: user.supabase,
      menuSlotId: slotId,
      originalIngredientId: parsed.data.original_ingredient_id,
    })
    const recompute = await recomputeGroceryListsForMenu({ admin, menuId })
    if (!recompute.ok) return serverError(recompute.detail)
    return jsonOk({ ok: true, recompute })
  } catch (err) {
    return serverError(err instanceof Error ? err.message : 'failed to remove substitution')
  }
}
