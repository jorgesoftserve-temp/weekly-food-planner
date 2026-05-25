import type { SupabaseClient } from '@supabase/supabase-js'
import type {
  GenerateMenuInput,
  GenerateMenuResult,
} from '@weekly-food-planner/constraint-engine'

export type PersistResult =
  | { ok: true; menuId: string | null; generationRunId: string }
  | { ok: false; detail: string }

// Replace-on-regenerate per DATABASE_PRD §6.17:
// 1. Soft-delete any existing active menu for the (workspace, week).
// 2. If the engine succeeded, insert the new menu + slots + grocery list + items
//    and a success generation_run.
// 3. If the engine failed, insert a failed generation_run only — the prior
//    soft-deleted menu is NOT restored (regenerate replaces unconditionally).
export const persistGeneratedMenu = async ({
  admin,
  workspaceId,
  weekStartDate,
  input,
  result,
}: {
  admin: SupabaseClient
  workspaceId: string
  weekStartDate: string
  input: GenerateMenuInput
  result: GenerateMenuResult
}): Promise<PersistResult> => {
  const { error: softDelErr } = await admin
    .from('menus')
    .update({ is_deleted: true })
    .eq('workspace_id', workspaceId)
    .eq('week_start_date', weekStartDate)
    .eq('is_deleted', false)
  if (softDelErr) return { ok: false, detail: softDelErr.message }

  if (!result.ok) {
    const { data: runRow, error: runErr } = await admin
      .from('generation_runs')
      .insert({
        workspace_id: workspaceId,
        seed: input.seed,
        inputs_hash: '',
        status: 'failed',
        error_payload: result.error,
        finished_at: new Date().toISOString(),
      })
      .select('id')
      .single()
    if (runErr || !runRow) {
      return { ok: false, detail: runErr?.message ?? 'failed-run insert failed' }
    }
    return { ok: true, menuId: null, generationRunId: (runRow as { id: string }).id }
  }

  const { data: menuRow, error: menuErr } = await admin
    .from('menus')
    .insert({
      workspace_id: workspaceId,
      week_start_date: weekStartDate,
      seed: input.seed,
      inputs_hash: result.inputsHash,
      generation_options: input.options ?? null,
    })
    .select('id')
    .single()
  if (menuErr || !menuRow) {
    return { ok: false, detail: menuErr?.message ?? 'menu insert failed' }
  }
  const menuId = (menuRow as { id: string }).id

  if (result.menu.slots.length > 0) {
    const { error: slotErr } = await admin.from('menu_slots').insert(
      result.menu.slots.map((slot) => ({
        menu_id: menuId,
        day_of_week: slot.dayOfWeek,
        meal_key: slot.mealKey,
        meal_type: slot.mealType,
        recipe_id: slot.recipeId,
        target_member_id: slot.targetMemberId,
      })),
    )
    if (slotErr) return { ok: false, detail: slotErr.message }
  }

  const { data: listRow, error: listErr } = await admin
    .from('grocery_lists')
    .insert({ menu_id: menuId, target_member_id: null })
    .select('id')
    .single()
  if (listErr || !listRow) {
    return { ok: false, detail: listErr?.message ?? 'grocery list insert failed' }
  }
  const listId = (listRow as { id: string }).id

  if (result.groceryLists.shared.items.length > 0) {
    const { error: itemErr } = await admin.from('grocery_items').insert(
      result.groceryLists.shared.items.map((item) => ({
        list_id: listId,
        ingredient_id: item.ingredientId,
        quantity: item.quantity,
        unit: item.unit,
        scheduled_purchase_day: item.scheduledPurchaseDay,
      })),
    )
    if (itemErr) return { ok: false, detail: itemErr.message }
  }

  const { data: runRow, error: runErr } = await admin
    .from('generation_runs')
    .insert({
      menu_id: menuId,
      workspace_id: workspaceId,
      seed: input.seed,
      inputs_hash: result.inputsHash,
      status: 'success',
      finished_at: new Date().toISOString(),
    })
    .select('id')
    .single()
  if (runErr || !runRow) {
    return { ok: false, detail: runErr?.message ?? 'success-run insert failed' }
  }

  return { ok: true, menuId, generationRunId: (runRow as { id: string }).id }
}
