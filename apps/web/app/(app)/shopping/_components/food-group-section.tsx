'use client'

import { useState } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { type DbTypes } from '@weekly-food-planner/supabase'

type AcquiredStatus = DbTypes.AcquiredStatus
import { ShoppingItemRow, type ShoppingItemRowData } from './shopping-item-row'

export type FoodGroupSectionProps = {
  foodGroup: string
  items: ShoppingItemRowData[]
  onPatch: ({
    groceryItemId,
    patch,
  }: {
    groceryItemId: string
    patch: { acquired_quantity?: number; status?: AcquiredStatus }
  }) => void
}

export const FoodGroupSection = ({ foodGroup, items, onPatch }: FoodGroupSectionProps) => {
  const [open, setOpen] = useState(true)
  const doneCount = items.filter(
    (i) => i.status === 'acquired' || i.status === 'skipped',
  ).length

  const panelId = `shopping-group-${foodGroup
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')}`

  return (
    <div className="flex flex-col gap-0 rounded-2xl border border-border bg-card overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center justify-between px-4 py-3 hover:bg-muted/50"
        aria-expanded={open}
        aria-controls={panelId}
      >
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold">{foodGroup}</span>
          <span className="text-xs text-muted-foreground">
            {doneCount}/{items.length}
          </span>
        </div>
        {open ? (
          <ChevronUp className="size-4 text-muted-foreground" aria-hidden />
        ) : (
          <ChevronDown className="size-4 text-muted-foreground" aria-hidden />
        )}
      </button>

      {open && (
        <div id={panelId} className="flex flex-col divide-y divide-border px-4 pb-3">
          {items.map((item) => (
            <div key={item.id} className="py-2.5">
              <ShoppingItemRow item={item} onPatch={onPatch} />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
