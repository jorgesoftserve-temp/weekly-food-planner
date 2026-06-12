import type { SupabaseClient } from '@supabase/supabase-js'
import type { CreateMenuAddonPayload, MenuAddonRow, UpdateMenuAddonPatch } from '../types/db.js'

// (v2.1 Track D) Addon attachments for an accepted menu. Keyed by menu_id so
// this table is structurally invisible to accepted_seed — exactly like
// menu_slot_ingredient_overrides. RLS via menus.workspace_id. DATABASE_PRD §6.24.

export type MenuAddonRecord = MenuAddonRow

export const menuAddonQueryKeys = {
  forMenu: (menuId: string) => ['menu-addons', 'menu', menuId] as const,
}

export const menuAddonKeys = {
  forMenu: (menuId: string) => ['menu-addons', 'menu', menuId] as const,
}

const ADDON_COLUMNS =
  'id, menu_id, workspace_id, addon_recipe_id, target_slot_id, servings, note, created_by, created_at, updated_at'

export const getMenuAddons = async ({
  supabase,
  menuId,
}: {
  supabase: SupabaseClient
  menuId: string
}): Promise<MenuAddonRecord[]> => {
  const { data, error } = await supabase
    .from('menu_addons')
    .select(ADDON_COLUMNS)
    .eq('menu_id', menuId)
    .order('created_at', { ascending: true })
  if (error) throw new Error(error.message)
  return (data ?? []) as unknown as MenuAddonRecord[]
}

/**
 * Attach an addon recipe to a menu (whole-week when target_slot_id is null,
 * slot-scoped when set). The route layer resolves workspace_id + created_by,
 * validates that the recipe is kind='addon', and re-runs
 * recomputeGroceryListsForMenu after attach.
 */
export const attachMenuAddon = async ({
  supabase,
  payload,
}: {
  supabase: SupabaseClient
  payload: CreateMenuAddonPayload
}): Promise<MenuAddonRecord> => {
  const { data, error } = await supabase
    .from('menu_addons')
    .insert({
      menu_id: payload.menu_id,
      workspace_id: payload.workspace_id,
      addon_recipe_id: payload.addon_recipe_id,
      target_slot_id: payload.target_slot_id ?? null,
      servings: payload.servings ?? null,
      note: payload.note ?? null,
      created_by: payload.created_by ?? null,
    })
    .select(ADDON_COLUMNS)
    .single()
  if (error || !data) {
    throw new Error(error?.message ?? 'failed to attach menu addon')
  }
  return data as unknown as MenuAddonRecord
}

/**
 * Update an existing addon attachment (servings, note, target_slot_id).
 * The route layer re-runs recomputeGroceryListsForMenu after update.
 */
export const updateMenuAddon = async ({
  supabase,
  addonId,
  patch,
}: {
  supabase: SupabaseClient
  addonId: string
  patch: UpdateMenuAddonPatch
}): Promise<void> => {
  if (Object.keys(patch).length === 0) throw new Error('no fields to update')
  const { error } = await supabase
    .from('menu_addons')
    .update(patch)
    .eq('id', addonId)
  if (error) throw new Error(error.message)
}

/**
 * Remove an addon attachment from a menu. The route layer re-runs
 * recomputeGroceryListsForMenu after detach to remove the addon grocery lines.
 */
export const detachMenuAddon = async ({
  supabase,
  addonId,
}: {
  supabase: SupabaseClient
  addonId: string
}): Promise<void> => {
  const { error } = await supabase
    .from('menu_addons')
    .delete()
    .eq('id', addonId)
  if (error) throw new Error(error.message)
}
