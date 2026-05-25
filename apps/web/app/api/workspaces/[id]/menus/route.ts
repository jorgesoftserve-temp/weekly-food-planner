import { type NextRequest } from 'next/server'
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
import { computeEffectiveOverlay, type RawOverlay } from '@/lib/api/menu-overlay'
import { persistGeneratedMenu } from '@/lib/api/menu-persistence'
import { supabaseAdminClient } from '@/utils/supabase/admin'
import { generateMenu } from '@weekly-food-planner/constraint-engine'
import type { GenerateMenuInput } from '@weekly-food-planner/constraint-engine'

type RouteParams = { id: string }

type GenerateBody = {
  weekStartDate: string
  seed?: number
  options?: RawOverlay
}

const generateRandomSeed = (): number => Math.floor(Math.random() * 2_147_483_647)

export const POST = async (
  request: NextRequest,
  { params }: { params: Promise<RouteParams> },
) => {
  const { id: workspaceId } = await params
  const user = await getAuthenticatedUser()
  if (!user) return unauthorized()
  const role = await getWorkspaceRole({
    supabase: user.supabase,
    userId: user.id,
    workspaceId,
  })
  if (!hasAdminRole(role)) return forbidden()

  const body = (await request.json().catch(() => null)) as GenerateBody | null
  if (!body || !body.weekStartDate) {
    return badRequest('weekStartDate is required (ISO date)')
  }

  const loaded = await loadEngineSnapshot({ supabase: user.supabase, workspaceId })
  if (!loaded.ok) {
    if (loaded.reason === 'workspace_not_found') return notFound()
    if (loaded.reason === 'no_recipes') {
      return jsonError(
        412,
        'empty_workspace',
        'Create at least one recipe in this workspace before generating a menu.',
      )
    }
    return serverError(loaded.detail ?? 'failed to load engine snapshot')
  }

  const effectiveOverlay = computeEffectiveOverlay({
    raw: body.options,
    members: loaded.members,
  })

  const seed = body.seed ?? generateRandomSeed()
  const input: GenerateMenuInput = {
    workspace: loaded.workspace,
    members: loaded.members,
    recipes: loaded.recipes,
    ingredients: loaded.ingredients,
    weekStartDate: body.weekStartDate,
    seed,
    options: effectiveOverlay,
  }

  const result = await generateMenu(input)

  const admin = supabaseAdminClient()
  const persisted = await persistGeneratedMenu({
    admin,
    workspaceId,
    weekStartDate: body.weekStartDate,
    input,
    result,
  })
  if (!persisted.ok) return serverError(persisted.detail)

  if (!result.ok) {
    return Response.json(
      {
        ok: false,
        error: result.error,
        generationRunId: persisted.generationRunId,
      },
      { status: 422 },
    )
  }

  return jsonOk({
    ok: true,
    menuId: persisted.menuId,
    inputsHash: result.inputsHash,
    seed,
    effectiveOverlay,
    menu: result.menu,
    groceryLists: result.groceryLists,
  })
}
