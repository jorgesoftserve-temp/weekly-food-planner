import { type NextRequest } from 'next/server'
import {
  getActiveShoppingSession,
  type ShoppingItemStatusRecord,
} from '@weekly-food-planner/supabase'
import {
  getAuthenticatedUser,
  getWorkspaceRole,
} from '@/lib/api/auth-helpers'
import {
  forbidden,
  jsonOk,
  notFound,
  unauthorized,
} from '@/lib/api/responses'
import { runWithErrorHandler } from '@/lib/api/route-helpers'

// (v2.0 Phase 2) Read the active shopping session for a menu.
// GET — any active workspace member may read.
//       ?group=food_group: additionally returns items bucketed by ingredient.food_group.
//       null food_group items are placed in a dedicated "Other" bucket.

type RouteParams = { id: string; menuId: string }

type GroupedItems = {
  foodGroup: string | null
  items: ShoppingItemStatusRecord[]
}

const groupItemsByFoodGroup = (
  items: ShoppingItemStatusRecord[],
): GroupedItems[] => {
  const map = new Map<string, ShoppingItemStatusRecord[]>()
  const NULL_KEY = '__null__'

  for (const item of items) {
    const key = item.grocery_item?.ingredient?.food_group ?? NULL_KEY
    if (!map.has(key)) map.set(key, [])
    map.get(key)!.push(item)
  }

  const groups: GroupedItems[] = []
  for (const [key, groupItems] of map.entries()) {
    groups.push({
      foodGroup: key === NULL_KEY ? null : key,
      items: groupItems,
    })
  }

  // Alphabetical by foodGroup name; null bucket last.
  return groups.sort((a, b) => {
    if (a.foodGroup === null) return 1
    if (b.foodGroup === null) return -1
    return a.foodGroup.localeCompare(b.foodGroup)
  })
}

export const GET = async (
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
  if (!role) return forbidden()

  const groupBy = request.nextUrl.searchParams.get('group')
  const wantFoodGrouping = groupBy === 'food_group'

  return runWithErrorHandler(async () => {
    const session = await getActiveShoppingSession({
      supabase: user.supabase,
      menuId,
    })
    if (!session) return notFound()

    if (wantFoodGrouping) {
      const groups = groupItemsByFoodGroup(session.items)
      return jsonOk({ session, groups })
    }

    return jsonOk({ session })
  })
}
