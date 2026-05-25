import { type NextRequest } from 'next/server'
import { searchLabels } from '@weekly-food-planner/supabase'
import { getAuthenticatedUser } from '@/lib/api/auth-helpers'
import { badRequest, jsonOk, unauthorized } from '@/lib/api/responses'
import { runWithErrorHandler } from '@/lib/api/route-helpers'

const ALLOWED_ENUM_TYPES = new Set([
  'cuisine_type',
  'dietary_restriction',
  'dietary_tag',
  'food_allergy',
])

export const GET = async (request: NextRequest) => {
  const user = await getAuthenticatedUser()
  if (!user) return unauthorized()

  const { searchParams } = new URL(request.url)
  const enumType = searchParams.get('enum_type')
  const query = searchParams.get('q') ?? ''

  if (!enumType || !ALLOWED_ENUM_TYPES.has(enumType)) {
    return badRequest(
      `enum_type must be one of: ${Array.from(ALLOWED_ENUM_TYPES).join(', ')}`,
    )
  }

  return runWithErrorHandler(async () => {
    const labels = await searchLabels({
      supabase: user.supabase,
      enumType,
      query,
    })
    return jsonOk({ labels })
  })
}
