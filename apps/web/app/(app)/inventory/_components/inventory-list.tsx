'use client'

import { useState } from 'react'
import { AlertTriangle, Package } from 'lucide-react'
import {
  deriveInventoryDisplayTag,
  type InventoryItemRecord,
} from '@weekly-food-planner/supabase'
import {
  useInventoryList,
  useCreateInventoryItem,
  useUpdateInventoryItem,
  useDeleteInventoryItem,
} from '@weekly-food-planner/supabase/react'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/empty-state'
import { useSupabase } from '@/lib/hooks/use-supabase'
import { notifySuccess, notifyError } from '@/lib/toast'
import { SourceFilter, type InventoryFilterKey } from './source-filter'
import { InventoryRow } from './inventory-row'
import { AddItemSheet } from './add-item-sheet'
import { parseQuantity, type AddItemFormValues } from './add-item.schema'

// Derive today as a timezone-naive YYYY-MM-DD string (mirrors date-utils.ts).
const getTodayYmd = (): string => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const NEAR_EXPIRY_DAYS = 3

const isNearExpiry = (expirationDate: string | null, todayYmd: string): boolean => {
  if (!expirationDate) return false
  const expiryMs = new Date(expirationDate).getTime()
  const todayMs = new Date(todayYmd).getTime()
  return expiryMs - todayMs <= NEAR_EXPIRY_DAYS * 24 * 60 * 60 * 1000 && expiryMs >= todayMs
}

const itemMatchesFilter = (
  item: InventoryItemRecord,
  filter: InventoryFilterKey,
  todayYmd: string,
): boolean => {
  if (filter === 'all') return true
  const tag = deriveInventoryDisplayTag({
    source: item.source,
    sourceMenu: item.source_menu,
    todayYmd,
  })
  return tag === filter
}

export const InventoryList = ({ workspaceId }: { workspaceId: string }) => {
  const supabase = useSupabase()
  const todayYmd = getTodayYmd()

  const inventoryQuery = useInventoryList({
    supabase,
    workspaceId,
    includeConsumed: false,
  })

  const createMutation = useCreateInventoryItem({ supabase, workspaceId })
  const updateMutation = useUpdateInventoryItem({ supabase, workspaceId })
  const deleteMutation = useDeleteInventoryItem({ supabase, workspaceId })

  const [filter, setFilter] = useState<InventoryFilterKey>('all')

  const items = inventoryQuery.data ?? []
  const nearExpiryCount = items.filter((i) => isNearExpiry(i.expiration_date, todayYmd)).length
  const visibleItems = items.filter((i) => itemMatchesFilter(i, filter, todayYmd))

  const isMutating =
    createMutation.isPending ||
    updateMutation.isPending ||
    deleteMutation.isPending

  const handleAdd = async ({ values }: { values: AddItemFormValues }) => {
    try {
      await createMutation.mutateAsync({
        ingredient_id: values.ingredient_id,
        quantity: parseQuantity(values.quantity),
        unit: values.unit,
        source: values.source,
        expiration_date: values.expiration_date || null,
        label: values.label || null,
      })
      notifySuccess('Item added to inventory')
    } catch (err) {
      notifyError(
        'Failed to add item',
        err instanceof Error ? err.message : undefined,
      )
    }
  }

  const handleDecrement = async ({ itemId }: { itemId: string }) => {
    const item = items.find((i) => i.id === itemId)
    if (!item) return
    const newQty = Math.max(0, item.quantity - 1)
    try {
      await updateMutation.mutateAsync({ itemId, patch: { quantity: newQty } })
    } catch (err) {
      notifyError(
        'Failed to update quantity',
        err instanceof Error ? err.message : undefined,
      )
    }
  }

  const handleIncrement = async ({ itemId }: { itemId: string }) => {
    const item = items.find((i) => i.id === itemId)
    if (!item) return
    try {
      await updateMutation.mutateAsync({ itemId, patch: { quantity: item.quantity + 1 } })
    } catch (err) {
      notifyError(
        'Failed to update quantity',
        err instanceof Error ? err.message : undefined,
      )
    }
  }

  const handleMarkConsumed = async ({ itemId }: { itemId: string }) => {
    try {
      await updateMutation.mutateAsync({ itemId, patch: { is_consumed: true } })
      notifySuccess('Marked as consumed')
    } catch (err) {
      notifyError(
        'Failed to mark as consumed',
        err instanceof Error ? err.message : undefined,
      )
    }
  }

  const handleDelete = async ({ itemId }: { itemId: string }) => {
    try {
      await deleteMutation.mutateAsync({ itemId })
      notifySuccess('Item removed')
    } catch (err) {
      notifyError(
        'Failed to remove item',
        err instanceof Error ? err.message : undefined,
      )
    }
  }

  // Loading skeleton
  if (inventoryQuery.isLoading) {
    return (
      <div className="flex flex-col gap-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-col gap-0.5">
            <Skeleton className="h-5 w-24" />
            <Skeleton className="mt-1 h-4 w-40" />
          </div>
          <Skeleton className="h-8 w-24 rounded-md" />
        </div>
        <div className="flex gap-2">
          {['All', 'Pantry', 'Menu', 'Leftover'].map((label) => (
            <Skeleton key={label} className="h-7 w-16 rounded-full" />
          ))}
        </div>
        <div className="flex flex-col gap-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full rounded-xl" />
          ))}
        </div>
      </div>
    )
  }

  // Error state
  if (inventoryQuery.error) {
    return (
      <EmptyState
        icon={Package}
        title="Couldn't load inventory"
        description={
          inventoryQuery.error instanceof Error
            ? inventoryQuery.error.message
            : 'An unexpected error occurred.'
        }
      />
    )
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Header row: pantry count + expiring soon warning + Add item */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-col gap-0.5">
          <h2 className="text-base font-semibold">Pantry</h2>
          <p className="text-sm text-muted-foreground">
            {items.length} {items.length === 1 ? 'item' : 'items'} on hand
            {nearExpiryCount > 0 && (
              <span className="ml-1.5 inline-flex items-center gap-1 text-amber-600 dark:text-amber-400">
                {'· '}
                <AlertTriangle className="size-3.5" aria-hidden />
                {nearExpiryCount} expiring soon
              </span>
            )}
          </p>
        </div>
        <AddItemSheet onAdd={handleAdd} isPending={createMutation.isPending} />
      </div>

      {/* Source filter pills */}
      <SourceFilter
        activeFilter={filter}
        onFilter={({ filter: f }) => setFilter(f)}
      />

      {/* Item list or empty states */}
      {items.length === 0 ? (
        <EmptyState
          icon={Package}
          title="No items in your pantry"
          description="Add items manually or finalize a shopping session to populate your inventory."
          action={<AddItemSheet onAdd={handleAdd} isPending={createMutation.isPending} />}
        />
      ) : visibleItems.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border bg-gradient-empty py-12 text-center">
          <div className="rounded-full bg-muted p-3 text-muted-foreground">
            <Package className="size-5" aria-hidden />
          </div>
          <div className="flex flex-col gap-1">
            <p className="text-sm font-medium">No items in this category</p>
            <p className="text-xs text-muted-foreground">
              Add items manually or finalize a shopping session to populate inventory.
            </p>
          </div>
        </div>
      ) : (
        <ul className="flex flex-col gap-2" aria-label="Inventory items">
          {visibleItems.map((item) => (
            <InventoryRow
              key={item.id}
              item={item}
              todayYmd={todayYmd}
              onDecrement={handleDecrement}
              onIncrement={handleIncrement}
              onMarkConsumed={handleMarkConsumed}
              onDelete={handleDelete}
              isPending={isMutating}
            />
          ))}
        </ul>
      )}
    </div>
  )
}
