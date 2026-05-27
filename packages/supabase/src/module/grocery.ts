import type { SupabaseClient } from '@supabase/supabase-js'
import type { Unit } from '../types/db.js'
import { isMenuStillUpcoming, todayYmd } from './date-utils.js'

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
  byMenuId: (workspaceId: string, menuId: string) =>
    ['grocery', 'byMenuId', workspaceId, menuId] as const,
}

export const groceryKeys = {
  active: (workspaceId: string) => ['grocery', 'active', workspaceId] as const,
  activeForWeek: (workspaceId: string, weekStartDate: string) =>
    ['grocery', 'active', workspaceId, weekStartDate] as const,
  byMenuId: (workspaceId: string, menuId: string) =>
    ['grocery', 'byMenuId', workspaceId, menuId] as const,
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
  // Grocery list always tracks an ACCEPTED menu. Drafts have no grocery
  // list of their own — they only become a shopping list once accepted
  // (DATABASE_PRD §6.13 + step-29 draft/accept lifecycle).
  //
  // When the caller doesn't ask for a specific week, prefer the menu the
  // user is **about to shop for** — the soonest upcoming accepted menu
  // (last day >= today). Falls back to the most recent accepted past menu
  // so an empty schedule still surfaces something. When a weekStartDate
  // is supplied (selector on the grocery page), we honour it exactly.
  if (weekStartDate) {
    const { data: menu, error: menuErr } = await supabase
      .from('menus')
      .select('id, week_start_date')
      .eq('workspace_id', workspaceId)
      .eq('is_deleted', false)
      .not('accepted_at', 'is', null)
      .eq('week_start_date', weekStartDate)
      .maybeSingle()
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

  const { data: candidates, error: candErr } = await supabase
    .from('menus')
    .select('id, week_start_date, duration_days')
    .eq('workspace_id', workspaceId)
    .eq('is_deleted', false)
    .not('accepted_at', 'is', null)
    .order('week_start_date', { ascending: false })
    .limit(20)
  if (candErr) throw new Error(candErr.message)
  type Cand = { id: string; week_start_date: string; duration_days: number }
  const rows = (candidates ?? []) as Cand[]
  if (rows.length === 0) return null
  const cutoff = todayYmd()
  const upcoming = [...rows]
    .reverse()
    .find((m) =>
      isMenuStillUpcoming({
        weekStartDate: m.week_start_date,
        durationDays: m.duration_days,
        todayYmd: cutoff,
      }),
    )
  const target = upcoming ?? rows[0]
  if (!target) return null
  const { data: lists, error: listErr } = await supabase
    .from('grocery_lists')
    .select(GROCERY_SELECT)
    .eq('menu_id', target.id)
  if (listErr) throw new Error(listErr.message)
  return {
    menuId: target.id,
    weekStartDate: target.week_start_date,
    lists: (lists ?? []) as unknown as GroceryListRecord[],
  }
}

// Loads grocery lists for an arbitrary menu_id. Used by the history
// drill-down so users can re-review what they shopped for a past menu
// without going through the active/upcoming cutoff logic. RLS still
// gates by workspace access — the menu row itself is what enforces
// visibility, the join from grocery_lists is the same.
export const getGroceryListsForMenuId = async ({
  supabase,
  menuId,
}: {
  supabase: SupabaseClient
  menuId: string
}): Promise<GroceryListRecord[]> => {
  const { data, error } = await supabase
    .from('grocery_lists')
    .select(GROCERY_SELECT)
    .eq('menu_id', menuId)
  if (error) throw new Error(error.message)
  return (data ?? []) as unknown as GroceryListRecord[]
}
