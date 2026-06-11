'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import {
  CalendarRange,
  ClipboardCheck,
  PackageCheck,
  ShoppingCart,
} from 'lucide-react'
import {
  useActiveGroceryLists,
  useActiveShoppingSession,
  useOpenShoppingSession,
  useUpdateShoppingItemStatus,
} from '@weekly-food-planner/supabase/react'
import {
  shoppingSessionKeys,
  inventoryKeys,
  type DbTypes,
} from '@weekly-food-planner/supabase'
import { useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/empty-state'
import { PageHeader } from '@/components/page-header'
import { useActiveWorkspace } from '@/components/workspace-provider'
import { useSupabase } from '@/lib/hooks/use-supabase'
import { notifySuccess, notifyError } from '@/lib/toast'
import { computeShoppingCompleteness } from '@/lib/api/shopping-finalize'
import { CompletenessMeter, completenessConfig } from './_components/completeness-meter'
import { FoodGroupSection } from './_components/food-group-section'
import { FinalizeDialog } from './_components/finalize-dialog'
import type { ShoppingItemRowData } from './_components/shopping-item-row'

// ── Helpers ───────────────────────────────────────────────────────────────────

type AcquiredStatus = DbTypes.AcquiredStatus

// Collect all grocery_item.id values from all lists for session seeding.
const collectGroceryItemIds = (
  lists: Array<{ grocery_items: Array<{ id: string }> }>,
): string[] => {
  const ids: string[] = []
  for (const list of lists) {
    for (const item of list.grocery_items) {
      ids.push(item.id)
    }
  }
  return ids
}

// Group session items by food_group. Null food_group → "Other".
type FoodGroup = {
  foodGroup: string
  items: ShoppingItemRowData[]
}

const groupByFoodGroup = (
  items: Array<{
    id: string
    grocery_item_id: string
    acquired_quantity: number
    status: AcquiredStatus
    grocery_item: {
      id: string
      ingredient_id: string
      quantity: number
      unit: string
      ingredient: { name: string; food_group: string | null } | null
    } | null
  }>,
): FoodGroup[] => {
  const map = new Map<string, ShoppingItemRowData[]>()

  for (const item of items) {
    const gi = item.grocery_item
    if (!gi) continue
    const name = gi.ingredient?.name ?? `[unknown:${gi.ingredient_id.slice(0, 6)}]`
    const group = gi.ingredient?.food_group ?? 'Other'

    if (!map.has(group)) map.set(group, [])
    map.get(group)!.push({
      id: item.id,
      grocery_item_id: item.grocery_item_id,
      name,
      requiredQty: gi.quantity,
      unit: gi.unit,
      acquiredQty: item.acquired_quantity,
      status: item.status,
    })
  }

  // Sort groups alphabetically, "Other" last.
  return Array.from(map.entries())
    .sort(([a], [b]) => {
      if (a === 'Other') return 1
      if (b === 'Other') return -1
      return a.localeCompare(b)
    })
    .map(([foodGroup, groupItems]) => ({ foodGroup, items: groupItems }))
}

// ── ShoppingPage ──────────────────────────────────────────────────────────────

const ShoppingPage = () => {
  const supabase = useSupabase()
  const queryClient = useQueryClient()
  const { workspace, isLoading: workspaceLoading } = useActiveWorkspace()

  const groceryQuery = useActiveGroceryLists({
    supabase,
    workspaceId: workspace?.id ?? null,
    enabled: !!workspace,
  })

  const menuId = groceryQuery.data?.menuId ?? null

  const sessionQuery = useActiveShoppingSession({
    supabase,
    menuId,
    enabled: !!menuId,
  })

  const openSessionMutation = useOpenShoppingSession({
    supabase,
    workspaceId: workspace?.id ?? '',
    menuId: menuId ?? '',
  })

  const updateItemMutation = useUpdateShoppingItemStatus({
    supabase,
    menuId: menuId ?? '',
  })

  const [showFinalizeDialog, setShowFinalizeDialog] = useState(false)
  const [isFinalizing, setIsFinalizing] = useState(false)

  const session = sessionQuery.data

  // Derive grouped items from the live session so the view is always in sync
  // with the server state (React Query refreshes after every mutation).
  const foodGroups = useMemo<FoodGroup[]>(() => {
    if (!session) return []
    return groupByFoodGroup(
      session.items as Parameters<typeof groupByFoodGroup>[0],
    )
  }, [session])

  // Live completeness from pure helper — matches exactly what finalize computes.
  // After finalizing we show session.completeness (the persisted value).
  const livePct = useMemo<number>(() => {
    if (!session) return 0
    if (session.status !== 'in_progress') {
      return session.completeness ?? 0
    }
    return computeShoppingCompleteness({ items: session.items })
  }, [session])

  const handleStartSession = () => {
    if (!groceryQuery.data) return
    const groceryItemIds = collectGroceryItemIds(groceryQuery.data.lists)
    openSessionMutation.mutate(
      { groceryItemIds, createdBy: undefined },
      {
        onError: (err) =>
          notifyError('Could not start shopping session', err.message),
      },
    )
  }

  const handleItemPatch = ({
    groceryItemId,
    patch,
  }: {
    groceryItemId: string
    patch: { acquired_quantity?: number; status?: AcquiredStatus }
  }) => {
    if (!session) return
    updateItemMutation.mutate(
      { sessionId: session.id, groceryItemId, patch },
      {
        onError: (err) =>
          notifyError('Could not update item', err.message),
      },
    )
  }

  const handleFinalize = async () => {
    if (!session || !workspace) return
    setIsFinalizing(true)
    try {
      const res = await fetch(
        `/api/workspaces/${workspace.id}/menus/${session.menu_id}/shopping-sessions/${session.id}/finalize`,
        { method: 'POST' },
      )
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: { message?: string } }
        throw new Error(body?.error?.message ?? `HTTP ${res.status}`)
      }
      // Invalidate so the session re-fetches its terminal status and the
      // inventory list reflects the newly-spilled items.
      await queryClient.invalidateQueries({ queryKey: shoppingSessionKeys.active(session.menu_id) })
      await queryClient.invalidateQueries({ queryKey: inventoryKeys.list(workspace.id) })
      notifySuccess('Shopping finalized', 'Purchased items have been added to your inventory.')
    } catch (err) {
      notifyError('Could not finalize', err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setIsFinalizing(false)
      setShowFinalizeDialog(false)
    }
  }

  // ── Loading ────────────────────────────────────────────────────────────────

  const isLoading =
    workspaceLoading ||
    groceryQuery.isLoading ||
    (!!menuId && sessionQuery.isLoading)

  if (isLoading) {
    return (
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
        <PageHeader title="Shopping" description="Loading your shopping session…" />
        <div className="flex flex-col gap-4">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-48 w-full" />
          <Skeleton className="h-48 w-full" />
        </div>
      </div>
    )
  }

  // ── Error ──────────────────────────────────────────────────────────────────

  if (groceryQuery.error || sessionQuery.error) {
    const errMsg =
      (groceryQuery.error instanceof Error ? groceryQuery.error.message : null) ??
      (sessionQuery.error instanceof Error ? sessionQuery.error.message : null) ??
      'Unknown error'
    return (
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
        <PageHeader title="Shopping" />
        <EmptyState
          icon={ShoppingCart}
          title="Couldn't load shopping data"
          description={errMsg}
        />
      </div>
    )
  }

  // ── No workspace ───────────────────────────────────────────────────────────

  if (!workspace) {
    return (
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
        <PageHeader title="Shopping" />
        <EmptyState
          icon={ShoppingCart}
          title="No workspace"
          description="You must belong to a workspace before you can shop."
        />
      </div>
    )
  }

  // ── No active menu ─────────────────────────────────────────────────────────

  if (!groceryQuery.data) {
    return (
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
        <PageHeader title="Shopping" description="Generate and accept a menu first." />
        <EmptyState
          icon={CalendarRange}
          title="No active menu"
          description="Accept a weekly menu to generate a grocery list — then start your shopping session here."
          action={
            <Button asChild>
              <Link href="/menu">Go to menu</Link>
            </Button>
          }
        />
      </div>
    )
  }

  const grocery = groceryQuery.data

  // ── No session yet → Start shopping CTA ───────────────────────────────────

  if (!session) {
    return (
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
        <PageHeader
          title="Shopping"
          description={`Week of ${grocery.weekStartDate} · grouped by food group`}
        />
        <EmptyState
          icon={ClipboardCheck}
          title="No active shopping session"
          description="Start a session to check off items as you shop. Your progress is saved in real time."
          action={
            <Button
              onClick={handleStartSession}
              disabled={openSessionMutation.isPending}
            >
              {openSessionMutation.isPending ? 'Starting…' : 'Start shopping'}
            </Button>
          }
        />
      </div>
    )
  }

  // ── Finalized → Read-only summary ─────────────────────────────────────────

  if (session.status !== 'in_progress') {
    const finalPct = session.completeness ?? livePct
    const cfg = completenessConfig(finalPct)
    const isComplete = session.status === 'complete'

    return (
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
        <PageHeader
          title="Shopping"
          description={`Week of ${grocery.weekStartDate} · session finalized`}
          actions={
            <Badge
              variant="outline"
              className={
                isComplete
                  ? 'bg-success-tint text-success border-transparent'
                  : 'bg-warning-tint text-warning border-transparent'
              }
            >
              {isComplete ? 'Complete' : 'Incomplete'}
            </Badge>
          }
        />
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-5">
            <div className="flex items-center gap-3">
              <PackageCheck className="size-5 text-success" aria-hidden />
              <span className="text-sm font-medium">Shopping session finalized</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-3xl font-bold tabular-nums">{finalPct}%</span>
              <Badge variant="outline" className={cfg.badgeClassName}>
                {cfg.label}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              Acquired items have been added to your Inventory. Missing or skipped items
              were not spilled.
            </p>
            <Button asChild variant="outline" className="self-start">
              <Link href="/inventory">View inventory</Link>
            </Button>
          </div>
        </div>
      </div>
    )
  }

  // ── In-progress session ────────────────────────────────────────────────────

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
      <PageHeader
        title="Shopping"
        description={`Week of ${grocery.weekStartDate} · grouped by food group`}
      />

      <div className="flex flex-col gap-5">
        {/* Completeness meter + finalize button */}
        <CompletenessMeter
          pct={livePct}
          onFinalize={() => setShowFinalizeDialog(true)}
          isFinalizing={isFinalizing}
        />

        {/* Grouped confirmation list */}
        <div className="flex flex-col gap-3">
          {foodGroups.length === 0 ? (
            <EmptyState
              icon={ShoppingCart}
              title="No grocery items for this session"
              description="The grocery lists were empty when this session was opened."
            />
          ) : (
            foodGroups.map((group) => (
              <FoodGroupSection
                key={group.foodGroup}
                foodGroup={group.foodGroup}
                items={group.items}
                onPatch={handleItemPatch}
              />
            ))
          )}
        </div>
      </div>

      <FinalizeDialog
        open={showFinalizeDialog}
        pct={livePct}
        onConfirm={handleFinalize}
        onCancel={() => setShowFinalizeDialog(false)}
        isFinalizing={isFinalizing}
      />
    </div>
  )
}

export default ShoppingPage
