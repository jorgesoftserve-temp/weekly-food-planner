import type { SupabaseClient } from '@supabase/supabase-js'
import { createInventoryItem, type DbTypes } from '@weekly-food-planner/supabase'

type Unit = DbTypes.Unit

// (v2.0 Phase 5) Cook-time leftovers. When a slot is marked `cooked`, the cook
// reconciliation can emit two kinds of inventory rows, both engine-free:
//   • raw-ingredient remainders (used < planned) → source 'cook_remainder' (Pantry)
//   • prepared-dish surplus (a portion you didn't eat) → source 'leftover'
//
// Each row gets its OWN expiry (PRODUCT_PRD §16, item 7), defaulted from the
// ingredient's max_storage_days else the workspace leftover_max_days fallback,
// counted from the cook date. The user can edit any row's expiry afterwards via
// PATCH /inventory/[itemId]. Auto-expiry is the lazy `expireLeftovers` sweep on
// inventory read (no cron in v2).

// ── Pure expiry math ─────────────────────────────────────────────────────────

// Add `days` calendar days to a YYYY-MM-DD date, returning YYYY-MM-DD. UTC so the
// result never drifts by a day across timezones.
const addDaysYmd = ({ ymd, days }: { ymd: string; days: number }): string => {
  const [y, m, d] = ymd.split('-').map((n) => Number.parseInt(n, 10))
  const dt = new Date(Date.UTC(y ?? 1970, (m ?? 1) - 1, d ?? 1))
  dt.setUTCDate(dt.getUTCDate() + days)
  return dt.toISOString().slice(0, 10)
}

// Default per-leftover expiry date. `maxStorageDays` (the ingredient's own shelf
// life) wins when known; otherwise the workspace `leftoverMaxDays` fallback.
export const computeLeftoverExpiry = ({
  cookedAtYmd,
  maxStorageDays,
  leftoverMaxDays,
}: {
  cookedAtYmd: string
  maxStorageDays: number | null
  leftoverMaxDays: number
}): string =>
  addDaysYmd({ ymd: cookedAtYmd, days: maxStorageDays ?? leftoverMaxDays })

// ── Leftover creation orchestrator ───────────────────────────────────────────

export type LeftoverLine = {
  ingredient_id: string
  quantity: number
  unit: Unit
}

export type CreateCookLeftoversInput = {
  supabase: SupabaseClient
  workspaceId: string
  menuId: string
  slotId: string
  /** Cook date (YYYY-MM-DD) the expiry is counted from. */
  cookedAtYmd: string
  /** Provenance label shown on the pantry row (typically the recipe name). */
  label: string | null
  /** workspace_members.id of the caller — satisfies the inventory row-owner RLS gate. */
  createdBy: string | null
  /** Raw-ingredient remainders (used < planned) → 'cook_remainder'. */
  remainders?: LeftoverLine[]
  /** Prepared-dish surplus → 'leftover'. */
  surplus?: LeftoverLine[]
}

export const createCookLeftovers = async ({
  supabase,
  workspaceId,
  menuId,
  slotId,
  cookedAtYmd,
  label,
  createdBy,
  remainders = [],
  surplus = [],
}: CreateCookLeftoversInput): Promise<{ createdCount: number }> => {
  const lines = [
    ...remainders.map((l) => ({ ...l, source: 'cook_remainder' as const })),
    ...surplus.map((l) => ({ ...l, source: 'leftover' as const })),
  ].filter((l) => l.quantity > 0)

  if (lines.length === 0) return { createdCount: 0 }

  // Per-ingredient shelf life + the workspace fallback, fetched once.
  const ingredientIds = Array.from(new Set(lines.map((l) => l.ingredient_id)))
  const [{ data: ingRows, error: ingErr }, { data: wsRow, error: wsErr }] =
    await Promise.all([
      supabase
        .from('ingredients')
        .select('id, max_storage_days')
        .in('id', ingredientIds),
      supabase
        .from('workspaces')
        .select('leftover_max_days')
        .eq('id', workspaceId)
        .single(),
    ])
  if (ingErr) throw new Error(ingErr.message)
  if (wsErr) throw new Error(wsErr.message)

  const storageById = new Map<string, number | null>()
  for (const row of (ingRows ?? []) as Array<{
    id: string
    max_storage_days: number | null
  }>) {
    storageById.set(row.id, row.max_storage_days)
  }
  const leftoverMaxDays = (wsRow as { leftover_max_days: number }).leftover_max_days

  for (const line of lines) {
    await createInventoryItem({
      supabase,
      workspaceId,
      payload: {
        ingredient_id: line.ingredient_id,
        source: line.source,
        quantity: line.quantity,
        unit: line.unit,
        expiration_date: computeLeftoverExpiry({
          cookedAtYmd,
          maxStorageDays: storageById.get(line.ingredient_id) ?? null,
          leftoverMaxDays,
        }),
        source_menu_id: menuId,
        source_slot_id: slotId,
        label,
        created_by: createdBy,
      },
    })
  }

  return { createdCount: lines.length }
}
