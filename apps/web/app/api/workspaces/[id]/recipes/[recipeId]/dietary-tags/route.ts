import { type NextRequest } from 'next/server'
import {
  getRecipe,
  replaceRecipeDietaryTags,
} from '@weekly-food-planner/supabase'
import {
  getAuthenticatedUser,
  getWorkspaceRole,
  hasAdminRole,
} from '@/lib/api/auth-helpers'
import {
  badRequest,
  forbidden,
  jsonOk,
  notFound,
  unauthorized,
} from '@/lib/api/responses'
import { runWithErrorHandler } from '@/lib/api/route-helpers'

type RouteParams = { id: string; recipeId: string }

type PutBody = { tags: string[] }

export const PUT = async (
  request: NextRequest,
  { params }: { params: Promise<RouteParams> },
) => {
  const { id: workspaceId, recipeId } = await params
  const user = await getAuthenticatedUser()
  if (!user) return unauthorized()
  const role = await getWorkspaceRole({
    supabase: user.supabase,
    userId: user.id,
    workspaceId,
  })
  if (!hasAdminRole(role)) return forbidden()

  const body = (await request.json().catch(() => null)) as PutBody | null
  if (
    !body ||
    !Array.isArray(body.tags) ||
    !body.tags.every((t) => typeof t === 'string' && t.length > 0)
  ) {
    return badRequest('body must be { tags: non-empty string[] }')
  }

  return runWithErrorHandler(async () => {
    const recipe = await getRecipe({
      supabase: user.supabase,
      workspaceId,
      recipeId,
    })
    if (!recipe) return notFound()
    await replaceRecipeDietaryTags({
      supabase: user.supabase,
      recipeId,
      tags: body.tags,
    })
    return jsonOk({ tags: body.tags })
  })
}
