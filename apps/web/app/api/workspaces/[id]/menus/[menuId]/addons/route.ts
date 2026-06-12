import { type NextRequest } from 'next/server'
import { z } from 'zod'
import {
  attachMenuAddon,
  detachMenuAddon,
  getRecipe,
} from '@weekly-food-planner/supabase'
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
  unauthorized,
} from '@/lib/api/responses'
import { runWithErrorHandler } from '@/lib/api/route-helpers'
import { formatZodError } from '@/lib/api/members'
import { recomputeGroceryListsForMenu } from '@/lib/api/menu-grocery'
import { supabaseAdminClient } from '@/utils/supabase/admin'

// (v2.1 Track D) Addon attachment routes.
// POST  — attach an addon recipe to the menu (week-wide or slot-scoped).
// DELETE — detach an addon by its menu_addons.id.
//
// Both verbs:
//   - Require creator/admin role (hasAdminRole).
//   - Only valid on an ACCEPTED menu (addons are post-accept menu state;
//     attaching to a draft would make accepted_seed computation ambiguous).
//   - After mutating menu_addons, re-run recomputeGroceryListsForMenu with
//     the admin client so addon ingredient lines are emitted/removed (tagged
//     source='addon'). The meal-derived lines are UNCHANGED — addon pass is
//     additive only. This ensures accepted_seed is byte-identical before/after.
//   - Use supabaseAdminClient for the grocery recompute (bypasses RLS on the
//     grocery tables, consistent with the menu pipeline). The addon
//     attach/detach itself uses the user-scoped client so RLS on menu_addons
//     applies (workspace creator/admin INSERT/DELETE policy).
//
// Status codes:
//   201  addon attached; body is the MenuAddonRecord
//   200  addon detached; body { deleted: true }
//   400  malformed JSON
//   401  not authenticated
//   403  caller is not admin/creator, or menu not in workspace
//   404  menu or recipe not found
//   409  menu is not yet accepted (attach/detach requires an accepted menu)
//   422  recipe is not kind='addon'
//   500  unexpected DB error (including recompute failure)

type RouteParams = { id: string; menuId: string }

const postBodySchema = z.object({
  addon_recipe_id: z.string().uuid('addon_recipe_id must be a UUID'),
  // null / omitted = whole-week addon; UUID = tied to a specific slot.
  target_slot_id: z.string().uuid().nullable().optional(),
  servings: z.number().positive().nullable().optional(),
  note: z.string().nullable().optional(),
})

const deleteBodySchema = z.object({
  addonId: z.string().uuid('addonId must be a UUID'),
})

// Helper: load and validate the menu. Returns the row or an error Response.
const loadAcceptedMenu = async ({
  admin,
  workspaceId,
  menuId,
}: {
  admin: ReturnType<typeof supabaseAdminClient>
  workspaceId: string
  menuId: string
}): Promise<
  | { ok: true; row: { id: string; workspace_id: string; accepted_at: string | null; is_deleted: boolean } }
  | { ok: false; response: Response }
> => {
  const { data, error } = await admin
    .from('menus')
    .select('id, workspace_id, accepted_at, is_deleted')
    .eq('id', menuId)
    .maybeSingle()
  if (error) return { ok: false, response: jsonError(500, 'db_error', error.message) }
  if (!data) return { ok: false, response: notFound() }
  const row = data as { id: string; workspace_id: string; accepted_at: string | null; is_deleted: boolean }
  if (row.workspace_id !== workspaceId || row.is_deleted) {
    return { ok: false, response: notFound() }
  }
  if (!row.accepted_at) {
    return {
      ok: false,
      response: jsonError(
        409,
        'menu_not_accepted',
        'Addons can only be attached to an accepted menu.',
      ),
    }
  }
  return { ok: true, row }
}

// POST /workspaces/:id/menus/:menuId/addons
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

  const raw = await request.json().catch(() => null)
  if (!raw) return badRequest('invalid JSON body')
  const parsed = postBodySchema.safeParse(raw)
  if (!parsed.success) return badRequest(formatZodError(parsed.error))

  // Use admin client for the grocery recompute; user client for menu_addons
  // insert (RLS enforces workspace membership on that table).
  const admin = supabaseAdminClient()

  return runWithErrorHandler(async () => {
    const menuCheck = await loadAcceptedMenu({ admin, workspaceId, menuId })
    if (!menuCheck.ok) return menuCheck.response

    // Verify the recipe exists in this workspace and is kind='addon'.
    const recipe = await getRecipe({
      supabase: user.supabase,
      workspaceId,
      recipeId: parsed.data.addon_recipe_id,
    })
    if (!recipe) return notFound()
    if (recipe.recipe_kind !== 'addon') {
      return jsonError(
        422,
        'invalid_recipe_kind',
        `Recipe ${parsed.data.addon_recipe_id} is not an addon recipe (recipe_kind='addon' required).`,
      )
    }

    const addon = await attachMenuAddon({
      supabase: user.supabase,
      payload: {
        menu_id: menuId,
        workspace_id: workspaceId,
        addon_recipe_id: parsed.data.addon_recipe_id,
        target_slot_id: parsed.data.target_slot_id ?? null,
        servings: parsed.data.servings ?? null,
        note: parsed.data.note ?? null,
        // Record which workspace member initiated the attachment for audit.
        // This is the supabase_user UUID, not the workspace_member UUID —
        // the module stores it as-is; the UI can cross-reference if needed.
        created_by: null,
      },
    })

    // Re-run grocery recompute so addon ingredient lines appear tagged
    // source='addon'. Meal-derived lines are unchanged (additive pass).
    // adminClient is required: grocery_lists + grocery_items bypass RLS here.
    const recompute = await recomputeGroceryListsForMenu({ admin, menuId })
    if (!recompute.ok) {
      return jsonError(
        500,
        'grocery_recompute_failed',
        `Addon attached but grocery recompute failed: ${recompute.detail}`,
      )
    }

    return jsonOk(addon, { status: 201 })
  })
}

// DELETE /workspaces/:id/menus/:menuId/addons
// Body: { addonId: string }
export const DELETE = async (
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

  const raw = await request.json().catch(() => null)
  if (!raw) return badRequest('invalid JSON body')
  const parsed = deleteBodySchema.safeParse(raw)
  if (!parsed.success) return badRequest(formatZodError(parsed.error))

  const admin = supabaseAdminClient()

  return runWithErrorHandler(async () => {
    const menuCheck = await loadAcceptedMenu({ admin, workspaceId, menuId })
    if (!menuCheck.ok) return menuCheck.response

    // detachMenuAddon uses the user-scoped client so the workspace RLS
    // DELETE policy applies (creator/admin check already passed above).
    await detachMenuAddon({ supabase: user.supabase, addonId: parsed.data.addonId })

    // Re-run grocery recompute to remove the addon ingredient lines.
    const recompute = await recomputeGroceryListsForMenu({ admin, menuId })
    if (!recompute.ok) {
      return jsonError(
        500,
        'grocery_recompute_failed',
        `Addon detached but grocery recompute failed: ${recompute.detail}`,
      )
    }

    return jsonOk({ deleted: true })
  })
}
