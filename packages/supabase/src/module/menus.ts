import type { SupabaseClient } from '@supabase/supabase-js'
import type { MealType } from '../types/db.js'

export type MenuSlotRecord = {
  id: string
  day_of_week: string
  meal_key: string
  meal_type: MealType
  recipe_id: string
  target_member_id: string | null
  is_overridden: boolean
  original_recipe_id: string | null
}

export type MenuType = 'weekly' | 'custom'

export type MenuRecord = {
  id: string
  week_start_date: string
  seed: number | null
  inputs_hash: string | null
  generation_options: unknown
  generated_at: string
  accepted_at: string | null
  accepted_seed: string | null
  menu_type: MenuType
  duration_days: number
  start_day_of_week: string
  cloned_from_menu_id: string | null
  menu_slots: MenuSlotRecord[]
}

export type MenuHistoryEntry = {
  id: string
  week_start_date: string
  seed: number | null
  inputs_hash: string | null
  accepted_at: string
  accepted_seed: string
  menu_type: MenuType
  duration_days: number
  is_modified: boolean
}

export const menuQueryKeys = {
  active: (workspaceId: string) => ['menus', 'active', workspaceId] as const,
  activeForWeek: (workspaceId: string, weekStartDate: string) =>
    ['menus', 'active', workspaceId, weekStartDate] as const,
  draft: (workspaceId: string) => ['menus', 'draft', workspaceId] as const,
  draftForWeek: (workspaceId: string, weekStartDate: string) =>
    ['menus', 'draft', workspaceId, weekStartDate] as const,
  history: (workspaceId: string) => ['menus', 'history', workspaceId] as const,
}

export const menuKeys = {
  active: (workspaceId: string) => ['menus', 'active', workspaceId] as const,
  activeForWeek: (workspaceId: string, weekStartDate: string) =>
    ['menus', 'active', workspaceId, weekStartDate] as const,
  draft: (workspaceId: string) => ['menus', 'draft', workspaceId] as const,
  draftForWeek: (workspaceId: string, weekStartDate: string) =>
    ['menus', 'draft', workspaceId, weekStartDate] as const,
  history: (workspaceId: string) => ['menus', 'history', workspaceId] as const,
}

const MENU_SELECT = `id, week_start_date, seed, inputs_hash, generation_options, generated_at,
  accepted_at, accepted_seed,
  menu_type, duration_days, start_day_of_week, cloned_from_menu_id,
  menu_slots (id, day_of_week, meal_key, meal_type, recipe_id, target_member_id, is_overridden, original_recipe_id)`

// Active = accepted-and-not-deleted. Replaces the previous "is_deleted=false"
// semantic now that drafts exist (drafts are also is_deleted=false but
// accepted_at IS NULL).
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
    .not('accepted_at', 'is', null)
    .order('week_start_date', { ascending: false })
    .limit(1)
  if (weekStartDate) query = query.eq('week_start_date', weekStartDate)
  const { data, error } = await query.maybeSingle()
  if (error) throw new Error(error.message)
  return (data as MenuRecord | null) ?? null
}

// The outstanding draft for a workspace (or for a specific week). At most one
// at a time per the partial unique index.
export const getDraftMenu = async ({
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
    .is('accepted_at', null)
    .order('generated_at', { ascending: false })
    .limit(1)
  if (weekStartDate) query = query.eq('week_start_date', weekStartDate)
  const { data, error } = await query.maybeSingle()
  if (error) throw new Error(error.message)
  return (data as MenuRecord | null) ?? null
}

// History: accepted menus in reverse-chronological order. Includes a derived
// is_modified flag computed from the joined menu_slots — true if any slot has
// is_overridden=true. We do this in JS rather than SQL to keep the module
// portable (no view dependency) and because the per-row cost is trivial.
export const listAcceptedMenus = async ({
  supabase,
  workspaceId,
  limit = 26,
}: {
  supabase: SupabaseClient
  workspaceId: string
  limit?: number
}): Promise<MenuHistoryEntry[]> => {
  const { data, error } = await supabase
    .from('menus')
    .select(
      `id, week_start_date, seed, inputs_hash, accepted_at, accepted_seed,
       menu_type, duration_days,
       menu_slots (is_overridden)`,
    )
    .eq('workspace_id', workspaceId)
    .eq('is_deleted', false)
    .not('accepted_at', 'is', null)
    .order('week_start_date', { ascending: false })
    .limit(limit)
  if (error) throw new Error(error.message)
  type RawRow = {
    id: string
    week_start_date: string
    seed: number | null
    inputs_hash: string | null
    accepted_at: string
    accepted_seed: string
    menu_type: MenuType
    duration_days: number
    menu_slots: Array<{ is_overridden: boolean }>
  }
  return ((data ?? []) as RawRow[]).map((row) => ({
    id: row.id,
    week_start_date: row.week_start_date,
    seed: row.seed,
    inputs_hash: row.inputs_hash,
    accepted_at: row.accepted_at,
    accepted_seed: row.accepted_seed,
    menu_type: row.menu_type,
    duration_days: row.duration_days,
    is_modified: row.menu_slots.some((s) => s.is_overridden),
  }))
}
