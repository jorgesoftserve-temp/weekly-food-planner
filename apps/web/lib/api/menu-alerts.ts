import type { SupabaseClient } from '@supabase/supabase-js'
import type { DbTypes } from '@weekly-food-planner/supabase'

type SlotCookStatus = DbTypes.SlotCookStatus

// (v2.0 Phase 3) Incomplete-shopping alerts — DERIVED, no table.
// PRODUCT_PRD §14, ARCHITECTURE_PRD §17.
//
// Given an accepted menu with a shopping session, surface a warning on every
// slot whose recipe needs an ingredient the user didn't acquire (skipped /
// partial / pending) AND that the pantry can't cover. State is fully derivable
// from existing rows, so we never persist it (high write-amplification
// otherwise — every status flip would fan out to N slots).
//
// Two pure cores (unit-tested) + one I/O orchestrator:
//   computeIngredientShortfalls — required − acquired − on-hand, per ingredient.
//   deriveSlotAlerts            — reverse map ingredient → not-yet-cooked slot.
//   deriveShoppingAlertsForMenu — loads the rows and runs the two cores.
//
// Degradation: cook-status (Phase 4 `slot_completions`) does not exist yet, so
// "not yet cooked" falls back to v1.9 `menu_slots.cooked_at` (null = planned).
// Ingredient overrides (Phase 6) likewise don't exist yet, so recipe_ingredients
// are read straight; when Phase 6 lands, apply the override map before the
// reverse mapping (see the TODO at the load site).

const EPSILON = 1e-9
const round2 = (n: number): number => Math.round(n * 100) / 100

// ---------------------------------------------------------------------------
// Pure types
// ---------------------------------------------------------------------------

export type MissingIngredient = {
  ingredientId: string
  name: string
  /** net quantity still missing after acquisition + on-hand inventory, in `unit`. */
  shortfall: number
  unit: string
}

export type SlotShoppingAlert = {
  slotId: string
  dayOfWeek: string
  mealKey: string
  recipeId: string
  recipeName: string | null
  targetMemberId: string | null
  missingIngredients: MissingIngredient[]
}

export type ShoppingAlertsResult = {
  menuId: string
  /** false when no shopping session exists — shortfall is then unknowable, so alerts is []. */
  hasSession: boolean
  sessionId: string | null
  sessionStatus: string | null
  alerts: SlotShoppingAlert[]
}

// ---------------------------------------------------------------------------
// Pure core 1 — per-ingredient shortfall
// ---------------------------------------------------------------------------

/**
 * Net shortfall per ingredient: Σ required − Σ acquired (capped to required) −
 * Σ on-hand inventory, matched on (ingredient_id, unit). Only positive
 * shortfalls are returned. When an ingredient appears in more than one unit the
 * entry with the larger shortfall wins (we surface a single line per ingredient
 * on the slot badge).
 *
 * - A grocery line with no status row is treated as fully missing (acquired 0).
 * - `skipped` / `pending` lines contribute their full required as shortfall.
 * - Inventory only offsets matching units (we never convert across units).
 */
export const computeIngredientShortfalls = ({
  groceryItems,
  statuses,
  inventory,
  ingredientNames,
}: {
  groceryItems: Array<{ id: string; ingredient_id: string; unit: string; quantity: number }>
  statuses: Array<{ grocery_item_id: string; acquired_quantity: number; status: string }>
  inventory: Array<{ ingredient_id: string; unit: string; quantity: number }>
  ingredientNames: Record<string, string>
}): Map<string, MissingIngredient> => {
  const statusByItem = new Map<string, { acquired: number; status: string }>()
  for (const s of statuses) {
    statusByItem.set(s.grocery_item_id, {
      acquired: Number(s.acquired_quantity),
      status: s.status,
    })
  }

  // Aggregate shortfall per (ingredient_id, unit).
  type Line = { ingredientId: string; unit: string; shortfall: number }
  const byKey = new Map<string, Line>()
  for (const gi of groceryItems) {
    const required = Number(gi.quantity)
    if (!(required > 0)) continue
    const st = statusByItem.get(gi.id)
    const acquired = st ? Math.min(Math.max(0, st.acquired), required) : 0
    const lineShort = required - acquired
    if (lineShort <= EPSILON) continue
    const key = `${gi.ingredient_id}::${gi.unit}`
    const existing = byKey.get(key)
    if (existing) existing.shortfall += lineShort
    else byKey.set(key, { ingredientId: gi.ingredient_id, unit: gi.unit, shortfall: lineShort })
  }

  // Offset with on-hand inventory matched on the same (ingredient, unit).
  const invByKey = new Map<string, number>()
  for (const inv of inventory) {
    const key = `${inv.ingredient_id}::${inv.unit}`
    invByKey.set(key, (invByKey.get(key) ?? 0) + Number(inv.quantity))
  }

  const byIngredient = new Map<string, MissingIngredient>()
  for (const [key, line] of byKey) {
    const onHand = invByKey.get(key) ?? 0
    const net = line.shortfall - onHand
    if (net <= EPSILON) continue
    const candidate: MissingIngredient = {
      ingredientId: line.ingredientId,
      name: ingredientNames[line.ingredientId] ?? line.ingredientId,
      shortfall: round2(net),
      unit: line.unit,
    }
    const prev = byIngredient.get(line.ingredientId)
    if (!prev || candidate.shortfall > prev.shortfall) {
      byIngredient.set(line.ingredientId, candidate)
    }
  }

  return byIngredient
}

// ---------------------------------------------------------------------------
// Pure core 2 — reverse map ingredient → slot
// ---------------------------------------------------------------------------

/**
 * One alert per still-planned slot whose recipe uses at least one short
 * ingredient. Slots already `cooked` (meal made — missing ingredient moot) or
 * `skipped` (intentionally not cooking) are suppressed. Cook-status comes from
 * slot_completions (Phase 4); an absent completion reads as 'planned'.
 */
export const deriveSlotAlerts = ({
  slots,
  recipeIngredientIds,
  shortByIngredient,
  recipeNames,
}: {
  slots: Array<{
    id: string
    recipe_id: string
    day_of_week: string
    meal_key: string
    target_member_id: string | null
    cookStatus: SlotCookStatus
  }>
  recipeIngredientIds: Map<string, string[]>
  shortByIngredient: Map<string, MissingIngredient>
  recipeNames: Record<string, string>
}): SlotShoppingAlert[] => {
  const alerts: SlotShoppingAlert[] = []
  for (const slot of slots) {
    if (slot.cookStatus !== 'planned') continue
    const ingIds = recipeIngredientIds.get(slot.recipe_id) ?? []
    const missing: MissingIngredient[] = []
    const seen = new Set<string>()
    for (const ingId of ingIds) {
      if (seen.has(ingId)) continue
      const m = shortByIngredient.get(ingId)
      if (m) {
        missing.push(m)
        seen.add(ingId)
      }
    }
    if (missing.length > 0) {
      alerts.push({
        slotId: slot.id,
        dayOfWeek: slot.day_of_week,
        mealKey: slot.meal_key,
        recipeId: slot.recipe_id,
        recipeName: recipeNames[slot.recipe_id] ?? null,
        targetMemberId: slot.target_member_id,
        missingIngredients: missing,
      })
    }
  }
  return alerts
}

// ---------------------------------------------------------------------------
// I/O orchestrator
// ---------------------------------------------------------------------------

/**
 * Loads the rows behind a menu's incomplete-shopping alerts and runs the two
 * pure cores. Reads only — uses the caller's RLS-bound client (every table
 * here is readable by an active workspace member). Engine-free; never touches
 * `accepted_seed`.
 */
export const deriveShoppingAlertsForMenu = async ({
  supabase,
  menuId,
}: {
  supabase: SupabaseClient
  menuId: string
}): Promise<ShoppingAlertsResult> => {
  const empty = (over: Partial<ShoppingAlertsResult> = {}): ShoppingAlertsResult => ({
    menuId,
    hasSession: false,
    sessionId: null,
    sessionStatus: null,
    alerts: [],
    ...over,
  })

  // 1. Menu → workspace_id (needed to scope inventory).
  const { data: menuRow, error: menuErr } = await supabase
    .from('menus')
    .select('id, workspace_id')
    .eq('id', menuId)
    .maybeSingle()
  if (menuErr) throw new Error(menuErr.message)
  if (!menuRow) throw new Error('menu not found')
  const workspaceId = (menuRow as { workspace_id: string }).workspace_id

  // 2. Latest shopping session for the menu (any status). No session → no
  //    shortfall signal, so no alerts.
  const { data: sessionRow, error: sessionErr } = await supabase
    .from('shopping_sessions')
    .select('id, status')
    .eq('menu_id', menuId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (sessionErr) throw new Error(sessionErr.message)
  if (!sessionRow) return empty()
  const session = sessionRow as { id: string; status: string }

  // 3. Shared grocery list(s) (target_member_id IS NULL) — the household total,
  //    so we don't double-count the per-member breakdown lists.
  const { data: listRows, error: listErr } = await supabase
    .from('grocery_lists')
    .select('id')
    .eq('menu_id', menuId)
    .is('target_member_id', null)
  if (listErr) throw new Error(listErr.message)
  const sharedListIds = ((listRows ?? []) as Array<{ id: string }>).map((l) => l.id)
  if (sharedListIds.length === 0) {
    return empty({ hasSession: true, sessionId: session.id, sessionStatus: session.status })
  }

  const { data: giRows, error: giErr } = await supabase
    .from('grocery_items')
    .select('id, ingredient_id, unit, quantity')
    .in('list_id', sharedListIds)
  if (giErr) throw new Error(giErr.message)
  const groceryItems = ((giRows ?? []) as Array<{
    id: string
    ingredient_id: string
    unit: string
    quantity: string | number
  }>).map((g) => ({ ...g, quantity: Number(g.quantity) }))

  if (groceryItems.length === 0) {
    return empty({ hasSession: true, sessionId: session.id, sessionStatus: session.status })
  }

  const groceryItemIds = groceryItems.map((g) => g.id)
  const ingredientIds = Array.from(new Set(groceryItems.map((g) => g.ingredient_id)))

  // 4. Per-line acquisition state for this session.
  const { data: statusRows, error: statusErr } = await supabase
    .from('shopping_item_status')
    .select('grocery_item_id, acquired_quantity, status')
    .eq('session_id', session.id)
    .in('grocery_item_id', groceryItemIds)
  if (statusErr) throw new Error(statusErr.message)
  const statuses = (statusRows ?? []) as Array<{
    grocery_item_id: string
    acquired_quantity: number
    status: string
  }>

  // 5. On-hand inventory for those ingredients (active stock only).
  const { data: invRows, error: invErr } = await supabase
    .from('inventory_items')
    .select('ingredient_id, unit, quantity')
    .eq('workspace_id', workspaceId)
    .eq('is_consumed', false)
    .in('ingredient_id', ingredientIds)
  if (invErr) throw new Error(invErr.message)
  const inventory = ((invRows ?? []) as Array<{
    ingredient_id: string
    unit: string
    quantity: string | number
  }>).map((i) => ({ ...i, quantity: Number(i.quantity) }))

  // 6. Slots (id, recipe, day, meal, member, cook signal).
  const { data: slotRows, error: slotErr } = await supabase
    .from('menu_slots')
    .select('id, recipe_id, day_of_week, meal_key, target_member_id, cooked_at')
    .eq('menu_id', menuId)
  if (slotErr) throw new Error(slotErr.message)
  const rawSlots = (slotRows ?? []) as Array<{
    id: string
    recipe_id: string
    day_of_week: string
    meal_key: string
    target_member_id: string | null
    cooked_at: string | null
  }>

  // 6b. Cook-status (Phase 4) — slot_completions keyed by menu_slot_id, joined
  //     through menu_slots to filter by menu. Absent row → 'planned'; falls back
  //     to the v1.9 cooked_at flag if somehow no completion exists.
  const { data: completionRows, error: completionErr } = await supabase
    .from('slot_completions')
    .select('menu_slot_id, status, menu_slot:menu_slots!inner (menu_id)')
    .eq('menu_slot.menu_id', menuId)
  if (completionErr) throw new Error(completionErr.message)
  const statusBySlot = new Map<string, SlotCookStatus>()
  for (const row of (completionRows ?? []) as Array<{
    menu_slot_id: string
    status: SlotCookStatus
  }>) {
    statusBySlot.set(row.menu_slot_id, row.status)
  }

  const slots = rawSlots.map((s) => ({
    id: s.id,
    recipe_id: s.recipe_id,
    day_of_week: s.day_of_week,
    meal_key: s.meal_key,
    target_member_id: s.target_member_id,
    cookStatus:
      statusBySlot.get(s.id) ?? (s.cooked_at ? 'cooked' : 'planned'),
  }))

  // 7. recipe_ingredients for the slots' recipes → ingredientId[] per recipe.
  //    TODO(Phase 6): left-join menu_slot_ingredient_overrides and substitute
  //    (ingredient_id) per slot before building this map.
  const recipeIds = Array.from(new Set(slots.map((s) => s.recipe_id)))
  const recipeIngredientIds = new Map<string, string[]>()
  if (recipeIds.length > 0) {
    const { data: riRows, error: riErr } = await supabase
      .from('recipe_ingredients')
      .select('recipe_id, ingredient_id')
      .in('recipe_id', recipeIds)
    if (riErr) throw new Error(riErr.message)
    for (const row of (riRows ?? []) as Array<{ recipe_id: string; ingredient_id: string }>) {
      const list = recipeIngredientIds.get(row.recipe_id) ?? []
      list.push(row.ingredient_id)
      recipeIngredientIds.set(row.recipe_id, list)
    }
  }

  // 8. Names for the short ingredients + recipe names for alert display.
  const { data: ingRows, error: ingErr } = await supabase
    .from('ingredients')
    .select('id, name')
    .in('id', ingredientIds)
  if (ingErr) throw new Error(ingErr.message)
  const ingredientNames: Record<string, string> = {}
  for (const row of (ingRows ?? []) as Array<{ id: string; name: string }>) {
    ingredientNames[row.id] = row.name
  }

  const recipeNames: Record<string, string> = {}
  if (recipeIds.length > 0) {
    const { data: recipeRows, error: recipeErr } = await supabase
      .from('recipes')
      .select('id, name')
      .in('id', recipeIds)
    if (recipeErr) throw new Error(recipeErr.message)
    for (const row of (recipeRows ?? []) as Array<{ id: string; name: string }>) {
      recipeNames[row.id] = row.name
    }
  }

  // 9. Run the pure cores.
  const shortByIngredient = computeIngredientShortfalls({
    groceryItems,
    statuses,
    inventory,
    ingredientNames,
  })
  const alerts = deriveSlotAlerts({
    slots,
    recipeIngredientIds,
    shortByIngredient,
    recipeNames,
  })

  return {
    menuId,
    hasSession: true,
    sessionId: session.id,
    sessionStatus: session.status,
    alerts,
  }
}
