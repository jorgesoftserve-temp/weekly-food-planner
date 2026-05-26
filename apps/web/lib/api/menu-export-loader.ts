import type { SupabaseClient } from '@supabase/supabase-js'
import {
  getActiveGroceryLists,
  getActiveMenu,
  type GroceryListRecord,
} from '@weekly-food-planner/supabase'
import type { ExportGroceryList, ExportInput } from './menu-export'
import { applyShopForFilter } from '@/lib/grocery-filter'

export type LoadExportResult =
  | { ok: true; export: ExportInput }
  | { ok: false; reason: 'workspace_not_found' | 'no_active_menu' | 'db_error'; detail?: string }

type WorkspaceRow = { name: string; type: 'individual' | 'group' }
type RecipeRow = { id: string; name: string }
type IngredientRow = { id: string; name: string }
type MemberRow = { id: string; name: string }

const collectIds = (values: ReadonlyArray<string | null>): string[] => {
  const set = new Set<string>()
  for (const v of values) if (v) set.add(v)
  return Array.from(set)
}

// Apply shop-for-subset semantics to the loaded grocery lists and reshape
// into the export schema. Extracted as a pure helper so the loader stays a
// thin orchestrator and the filter + reshape can be unit-tested without
// mocking Supabase. When `shopForIds` is null/empty/equal to participantIds,
// `applyShopForFilter` is a no-op pass-through (per its own contract).
export const buildExportGroceryLists = ({
  lists,
  participantIds,
  shopForIds,
}: {
  lists: GroceryListRecord[]
  participantIds: string[]
  shopForIds: string[] | null
}): ExportGroceryList[] => {
  const filtered = applyShopForFilter({
    lists,
    participantIds,
    selectedIds: shopForIds,
  })
  return filtered.map((fl) => ({
    targetMemberId: fl.target_member_id,
    items: fl.scaledItems.map((i) => ({
      ingredientId: i.ingredient_id,
      quantity: i.quantity,
      unit: i.unit,
      scheduledPurchaseDay: i.scheduled_purchase_day,
    })),
  }))
}

export const loadMenuExport = async ({
  supabase,
  workspaceId,
  weekStartDate,
  shopForIds,
}: {
  supabase: SupabaseClient
  workspaceId: string
  weekStartDate?: string
  // Optional shop-for-subset selection. When non-empty + a strict subset of
  // the menu's participants, the shared bucket is scaled down and per-member
  // buckets are filtered to only the selected members. Treated as no-op
  // when null, empty, or equal to the full participant set.
  shopForIds?: string[] | null
}): Promise<LoadExportResult> => {
  try {
    const { data: workspaceData, error: wsErr } = await supabase
      .from('workspaces')
      .select('name, type')
      .eq('id', workspaceId)
      .eq('is_deleted', false)
      .maybeSingle()
    if (wsErr) return { ok: false, reason: 'db_error', detail: wsErr.message }
    if (!workspaceData) return { ok: false, reason: 'workspace_not_found' }
    const workspace = workspaceData as WorkspaceRow

    const menu = await getActiveMenu({ supabase, workspaceId, weekStartDate })
    if (!menu) return { ok: false, reason: 'no_active_menu' }

    const grocery = await getActiveGroceryLists({
      supabase,
      workspaceId,
      weekStartDate,
    })

    // Build the (possibly filtered) export grocery lists up front so that
    // name lookups below only fetch entities that survive the filter.
    const participantIds = menu.menu_participants.map((p) => p.member_id)
    const groceryLists = buildExportGroceryLists({
      lists: grocery?.lists ?? [],
      participantIds,
      shopForIds: shopForIds ?? null,
    })

    const recipeIds = collectIds(menu.menu_slots.map((s) => s.recipe_id))
    const ingredientIds = collectIds(
      groceryLists.flatMap((l) => l.items.map((i) => i.ingredientId)),
    )
    const memberIds = collectIds([
      ...menu.menu_slots.map((s) => s.target_member_id),
      ...groceryLists.map((l) => l.targetMemberId),
    ])

    const recipes: Record<string, { name: string }> = {}
    if (recipeIds.length > 0) {
      const { data, error } = await supabase
        .from('recipes')
        .select('id, name')
        .in('id', recipeIds)
      if (error) return { ok: false, reason: 'db_error', detail: error.message }
      for (const row of (data ?? []) as RecipeRow[]) {
        recipes[row.id] = { name: row.name }
      }
    }

    const ingredients: Record<string, { name: string }> = {}
    if (ingredientIds.length > 0) {
      const { data, error } = await supabase
        .from('ingredients')
        .select('id, name')
        .in('id', ingredientIds)
      if (error) return { ok: false, reason: 'db_error', detail: error.message }
      for (const row of (data ?? []) as IngredientRow[]) {
        ingredients[row.id] = { name: row.name }
      }
    }

    const members: Record<string, { name: string }> = {}
    if (memberIds.length > 0) {
      const { data, error } = await supabase
        .from('workspace_members')
        .select('id, name')
        .in('id', memberIds)
      if (error) return { ok: false, reason: 'db_error', detail: error.message }
      for (const row of (data ?? []) as MemberRow[]) {
        members[row.id] = { name: row.name }
      }
    }

    return {
      ok: true,
      export: {
        workspace,
        menu: {
          weekStartDate: menu.week_start_date,
          seed: menu.seed,
          inputsHash: menu.inputs_hash,
          generatedAt: menu.generated_at,
          slots: menu.menu_slots.map((s) => ({
            dayOfWeek: s.day_of_week,
            mealKey: s.meal_key,
            mealType: s.meal_type,
            recipeId: s.recipe_id,
            targetMemberId: s.target_member_id,
          })),
        },
        groceryLists,
        recipes,
        ingredients,
        members,
      },
    }
  } catch (err) {
    return {
      ok: false,
      reason: 'db_error',
      detail: err instanceof Error ? err.message : 'unknown',
    }
  }
}
