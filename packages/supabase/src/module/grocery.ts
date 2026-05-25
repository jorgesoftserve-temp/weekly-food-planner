import type { SupabaseClient } from '@supabase/supabase-js'
import type { Unit } from '../types/db.js'

export type GroceryItem = {
  id: string
  ingredient_id: string
  quantity: string | number
  unit: Unit
  scheduled_purchase_day: string | null
}

export type GroceryListRecord = {
  id: string
  target_member_id: string | null
  grocery_items: GroceryItem[]
}

export type ActiveGroceryResult = {
  menuId: string
  weekStartDate: string
  lists: GroceryListRecord[]
}

export const groceryQueryKeys = {
  active: (workspaceId: string) => ['grocery', 'active', workspaceId] as const,
  activeForWeek: (workspaceId: string, weekStartDate: string) =>
    ['grocery', 'active', workspaceId, weekStartDate] as const,
}

export const groceryKeys = {
  active: (workspaceId: string) => ['grocery', 'active', workspaceId] as const,
  activeForWeek: (workspaceId: string, weekStartDate: string) =>
    ['grocery', 'active', workspaceId, weekStartDate] as const,
}

const GROCERY_SELECT = `id, target_member_id,
  grocery_items (id, ingredient_id, quantity, unit, scheduled_purchase_day)`

export const getActiveGroceryLists = async ({
  supabase,
  workspaceId,
  weekStartDate,
}: {
  supabase: SupabaseClient
  workspaceId: string
  weekStartDate?: string
}): Promise<ActiveGroceryResult | null> => {
  let menuQuery = supabase
    .from('menus')
    .select('id, week_start_date')
    .eq('workspace_id', workspaceId)
    .eq('is_deleted', false)
    .order('week_start_date', { ascending: false })
    .limit(1)
  if (weekStartDate) menuQuery = menuQuery.eq('week_start_date', weekStartDate)
  const { data: menu, error: menuErr } = await menuQuery.maybeSingle()
  if (menuErr) throw new Error(menuErr.message)
  if (!menu) return null
  const menuRow = menu as { id: string; week_start_date: string }
  const { data: lists, error: listErr } = await supabase
    .from('grocery_lists')
    .select(GROCERY_SELECT)
    .eq('menu_id', menuRow.id)
  if (listErr) throw new Error(listErr.message)
  return {
    menuId: menuRow.id,
    weekStartDate: menuRow.week_start_date,
    lists: (lists ?? []) as unknown as GroceryListRecord[],
  }
}
