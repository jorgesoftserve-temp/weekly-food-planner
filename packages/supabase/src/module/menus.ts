import type { SupabaseClient } from '@supabase/supabase-js'
import type { MealType } from '../types/db.js'

export type MenuSlotRecord = {
  id: string
  day_of_week: string
  meal_key: string
  meal_type: MealType
  recipe_id: string
  target_member_id: string | null
}

export type MenuRecord = {
  id: string
  week_start_date: string
  seed: number
  inputs_hash: string
  generation_options: unknown
  generated_at: string
  menu_slots: MenuSlotRecord[]
}

export const menuQueryKeys = {
  active: (workspaceId: string) => ['menus', 'active', workspaceId] as const,
  activeForWeek: (workspaceId: string, weekStartDate: string) =>
    ['menus', 'active', workspaceId, weekStartDate] as const,
}

export const menuKeys = {
  active: (workspaceId: string) => ['menus', 'active', workspaceId] as const,
  activeForWeek: (workspaceId: string, weekStartDate: string) =>
    ['menus', 'active', workspaceId, weekStartDate] as const,
}

const MENU_SELECT = `id, week_start_date, seed, inputs_hash, generation_options, generated_at,
  menu_slots (id, day_of_week, meal_key, meal_type, recipe_id, target_member_id)`

export const getActiveMenu = async ({
  supabase,
  workspaceId,
  weekStartDate,
}: {
  supabase: SupabaseClient
  workspaceId: string
  weekStartDate?: string
}): Promise<MenuRecord | null> => {
  let query = supabase
    .from('menus')
    .select(MENU_SELECT)
    .eq('workspace_id', workspaceId)
    .eq('is_deleted', false)
    .order('week_start_date', { ascending: false })
    .limit(1)
  if (weekStartDate) query = query.eq('week_start_date', weekStartDate)
  const { data, error } = await query.maybeSingle()
  if (error) throw new Error(error.message)
  return (data as MenuRecord | null) ?? null
}
