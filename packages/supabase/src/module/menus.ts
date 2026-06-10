import type { SupabaseClient } from '@supabase/supabase-js'
import type { MealType } from '../types/db.js'
import { isMenuStillUpcoming, todayYmd } from './date-utils.js'

export type MenuSlotRecord = {
  id: string
  day_of_week: string
  meal_key: string
  meal_type: MealType
  recipe_id: string
  target_member_id: string | null
  is_overridden: boolean
  original_recipe_id: string | null
  // Cook-mode runtime state (v1.9). NULL = not cooked. Never an engine input.
  cooked_at: string | null
  cooked_by: string | null
}

export type MenuType = 'weekly' | 'custom'

export type MenuParticipantRow = { member_id: string }

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
  menu_participants: MenuParticipantRow[]
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
  upcoming: (workspaceId: string) => ['menus', 'upcoming', workspaceId] as const,
  history: (workspaceId: string) => ['menus', 'history', workspaceId] as const,
  byId: (workspaceId: string, menuId: string) =>
    ['menus', 'byId', workspaceId, menuId] as const,
}

export const menuKeys = {
  active: (workspaceId: string) => ['menus', 'active', workspaceId] as const,
  activeForWeek: (workspaceId: string, weekStartDate: string) =>
    ['menus', 'active', workspaceId, weekStartDate] as const,
  draft: (workspaceId: string) => ['menus', 'draft', workspaceId] as const,
  draftForWeek: (workspaceId: string, weekStartDate: string) =>
    ['menus', 'draft', workspaceId, weekStartDate] as const,
  upcoming: (workspaceId: string) => ['menus', 'upcoming', workspaceId] as const,
  history: (workspaceId: string) => ['menus', 'history', workspaceId] as const,
  byId: (workspaceId: string, menuId: string) =>
    ['menus', 'byId', workspaceId, menuId] as const,
}

const MENU_SELECT = `id, week_start_date, seed, inputs_hash, generation_options, generated_at,
  accepted_at, accepted_seed,
  menu_type, duration_days, start_day_of_week, cloned_from_menu_id,
  menu_slots (id, day_of_week, meal_key, meal_type, recipe_id, target_member_id, is_overridden, original_recipe_id, cooked_at, cooked_by),
  menu_participants (member_id)`

// Active = accepted-and-not-deleted, preferring the **soonest upcoming**
// menu (the one whose end date is in the future). Falls back to the most
// recently accepted past menu so a workspace that hasn't planned a new
// week yet still sees something. Callers that need an exact week pass
// `weekStartDate`.
export const getActiveMenu = async ({
  supabase,
  workspaceId,
  weekStartDate,
}: {
  supabase: SupabaseClient
  workspaceId: string
  weekStartDate?: string
}): Promise<MenuRecord | null> => {
  if (weekStartDate) {
    const { data, error } = await supabase
      .from('menus')
      .select(MENU_SELECT)
      .eq('workspace_id', workspaceId)
      .eq('is_deleted', false)
      .not('accepted_at', 'is', null)
      .eq('week_start_date', weekStartDate)
      .maybeSingle()
    if (error) throw new Error(error.message)
    return (data as MenuRecord | null) ?? null
  }
  // Pull a small batch of recent accepted menus and decide client-side:
  // upcoming wins; if none are upcoming, fall back to the most recent one.
  const { data, error } = await supabase
    .from('menus')
    .select(MENU_SELECT)
    .eq('workspace_id', workspaceId)
    .eq('is_deleted', false)
    .not('accepted_at', 'is', null)
    .order('week_start_date', { ascending: false })
    .limit(20)
  if (error) throw new Error(error.message)
  const rows = (data ?? []) as MenuRecord[]
  if (rows.length === 0) return null
  const cutoff = todayYmd()
  // rows are desc by week_start_date; reverse + find earliest upcoming
  // so the user sees "this week" before "next week" when both exist.
  const upcoming = [...rows]
    .reverse()
    .find((m) =>
      isMenuStillUpcoming({
        weekStartDate: m.week_start_date,
        durationDays: m.duration_days,
        todayYmd: cutoff,
      }),
    )
  return upcoming ?? rows[0] ?? null
}

// Loads a single menu by id, scoped to a workspace. Used by the history
// drill-down page — RLS still enforces workspace access, but scoping by
// workspaceId catches a stale URL pointing at a workspace the user no
// longer has a role in. Past menus stay readable here (the cutoff filter
// only applies to "active" + "upcoming" loaders) so users can review
// what they cooked any week back.
export const getMenuById = async ({
  supabase,
  workspaceId,
  menuId,
}: {
  supabase: SupabaseClient
  workspaceId: string
  menuId: string
}): Promise<MenuRecord | null> => {
  const { data, error } = await supabase
    .from('menus')
    .select(MENU_SELECT)
    .eq('id', menuId)
    .eq('workspace_id', workspaceId)
    .eq('is_deleted', false)
    .maybeSingle()
  if (error) throw new Error(error.message)
  return (data as MenuRecord | null) ?? null
}

// Accepted menus whose last day is today or later. Returned in
// chronological order so the grocery page can render a "shop this one
// next" picker. Excludes past menus by design — they're available via
// /menu/history if the user wants them.
export const listUpcomingAcceptedMenus = async ({
  supabase,
  workspaceId,
}: {
  supabase: SupabaseClient
  workspaceId: string
}): Promise<MenuRecord[]> => {
  const { data, error } = await supabase
    .from('menus')
    .select(MENU_SELECT)
    .eq('workspace_id', workspaceId)
    .eq('is_deleted', false)
    .not('accepted_at', 'is', null)
    .order('week_start_date', { ascending: true })
  if (error) throw new Error(error.message)
  const rows = (data ?? []) as MenuRecord[]
  const cutoff = todayYmd()
  return rows.filter((m) =>
    isMenuStillUpcoming({
      weekStartDate: m.week_start_date,
      durationDays: m.duration_days,
      todayYmd: cutoff,
    }),
  )
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
