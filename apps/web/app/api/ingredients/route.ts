import { listIngredients } from '@weekly-food-planner/supabase'
import { getAuthenticatedUser } from '@/lib/api/auth-helpers'
import { jsonOk, unauthorized } from '@/lib/api/responses'
import { runWithErrorHandler } from '@/lib/api/route-helpers'

export const GET = async () => {
  const user = await getAuthenticatedUser()
  if (!user) return unauthorized()
  return runWithErrorHandler(async () => {
    const ingredients = await listIngredients({ supabase: user.supabase })
    return jsonOk({ ingredients })
  })
}
