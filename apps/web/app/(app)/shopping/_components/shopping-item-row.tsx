'use client'

import { useState } from 'react'
import { CheckCircle2, Minus, Plus } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { type DbTypes } from '@weekly-food-planner/supabase'

type AcquiredStatus = DbTypes.AcquiredStatus

// ── Status badge ──────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<AcquiredStatus, { label: string; className: string }> = {
  pending:  { label: 'Pending',  className: 'border-border text-muted-foreground' },
  acquired: { label: 'Acquired', className: 'bg-success-tint text-success border-transparent' },
  partial:  { label: 'Partial',  className: 'bg-warning-tint text-warning border-transparent' },
  skipped:  { label: 'Skipped',  className: 'bg-muted text-muted-foreground border-transparent' },
}

const StatusBadge = ({ status }: { status: AcquiredStatus }) => {
  const cfg = STATUS_CONFIG[status]
  return (
    <Badge variant="outline" className={cn('text-xs', cfg.className)}>
      {cfg.label}
    </Badge>
  )
}

// ── Helpers ───────────────────────────────────────────────────────────────────

export type ShoppingItemRowData = {
  /** shopping_item_status.id */
  id: string
  grocery_item_id: string
  name: string
  /** required quantity as a number */
  requiredQty: number
  unit: string
  /** current acquired quantity */
  acquiredQty: number
  status: AcquiredStatus
}

// ── ShoppingItemRow ───────────────────────────────────────────────────────────
// Three discrete actions: [check] toggles pending ↔ acquired;
// [Partial] activates partial status + reveals qty stepper;
// [Skip] sets skipped.
// All mutations are delegated upward via onPatch so the parent owns the
// network call (useUpdateShoppingItemStatus).

export const ShoppingItemRow = ({
  item,
  onPatch,
}: {
  item: ShoppingItemRowData
  onPatch: ({
    groceryItemId,
    patch,
  }: {
    groceryItemId: string
    patch: { acquired_quantity?: number; status?: AcquiredStatus }
  }) => void
}) => {
  const { requiredQty, unit } = item

  // Local stepper value — initialised from item's current acquired qty when
  // partial, otherwise 0. Stays local until the user clicks a control.
  const [partialValue, setPartialValue] = useState<number>(() =>
    item.status === 'partial' ? item.acquiredQty : 0,
  )

  // When a partial count reaches the required amount we ask the user whether
  // to escalate the row to fully acquired (shared ConfirmDialog, not the
  // native confirm()).
  const [showAcquireConfirm, setShowAcquireConfirm] = useState(false)

  const handleCheck = () => {
    if (item.status === 'acquired') {
      onPatch({ groceryItemId: item.grocery_item_id, patch: { status: 'pending', acquired_quantity: 0 } })
    } else {
      onPatch({ groceryItemId: item.grocery_item_id, patch: { status: 'acquired', acquired_quantity: requiredQty } })
    }
  }

  const handlePartial = () => {
    const safeValue = Math.min(partialValue, requiredQty)
    onPatch({ groceryItemId: item.grocery_item_id, patch: { status: 'partial', acquired_quantity: safeValue } })
  }

  const handleSkip = () => {
    onPatch({ groceryItemId: item.grocery_item_id, patch: { status: 'skipped', acquired_quantity: 0 } })
  }

  const handleStepperChange = (newValue: number) => {
    const clamped = Math.max(0, Math.min(newValue, requiredQty))
    setPartialValue(clamped)
    if (item.status === 'partial') {
      // Persist the partial count first so progress is never lost, then ask
      // whether to escalate to fully acquired once it matches the requirement.
      onPatch({ groceryItemId: item.grocery_item_id, patch: { acquired_quantity: clamped } })
      if (clamped === requiredQty && requiredQty > 0) {
        setShowAcquireConfirm(true)
      }
    }
  }

  const handleConfirmAcquire = () => {
    setShowAcquireConfirm(false)
    onPatch({ groceryItemId: item.grocery_item_id, patch: { status: 'acquired', acquired_quantity: requiredQty } })
  }

  const isPartial = item.status === 'partial'

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
        {/* Name + check circle */}
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <button
            type="button"
            onClick={handleCheck}
            aria-label={
              item.status === 'acquired'
                ? `Uncheck ${item.name} — mark as pending`
                : `Check ${item.name} — mark as fully acquired`
            }
            className="shrink-0 text-muted-foreground hover:text-success focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 rounded-full"
          >
            {item.status === 'acquired' ? (
              <CheckCircle2 className="size-5 text-success" aria-hidden />
            ) : (
              <div className="size-5 rounded-full border-2 border-border" aria-hidden />
            )}
          </button>
          <span
            className={cn(
              'min-w-0 truncate text-sm',
              (item.status === 'acquired' || item.status === 'skipped') &&
                'text-muted-foreground line-through',
            )}
          >
            {item.name}
          </span>
        </div>

        {/* Required qty */}
        <div className="text-xs text-muted-foreground tabular-nums">
          Need: {requiredQty} {unit}
        </div>

        {/* Status badge — only for pending. Acquired is shown by the filled
            check circle, partial/skipped by their active action buttons, so a
            badge there would duplicate the same state. */}
        {item.status === 'pending' && (
          <div className="shrink-0">
            <StatusBadge status="pending" />
          </div>
        )}

        {/* Action buttons */}
        <div className="flex shrink-0 items-center gap-1.5">
          <button
            type="button"
            onClick={handlePartial}
            aria-pressed={isPartial}
            aria-label={`Mark ${item.name} as partially found`}
            className={cn(
              'rounded-full border px-2.5 py-0.5 text-xs font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1',
              isPartial
                ? 'border-warning/40 bg-warning-tint text-warning'
                : 'border-border text-muted-foreground hover:bg-muted',
            )}
          >
            Partial
          </button>
          <button
            type="button"
            onClick={handleSkip}
            aria-pressed={item.status === 'skipped'}
            aria-label={`Skip ${item.name}`}
            className={cn(
              'rounded-full border px-2.5 py-0.5 text-xs font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1',
              item.status === 'skipped'
                ? 'border-transparent bg-muted text-muted-foreground'
                : 'border-border text-muted-foreground hover:bg-muted',
            )}
          >
            Skip
          </button>
        </div>
      </div>

      {/* Inline partial qty selector — only visible when status is partial */}
      {isPartial && (
        <div className="flex items-center gap-2 rounded-lg border border-warning/30 bg-warning-tint/30 px-3 py-2">
          <span className="text-xs text-muted-foreground shrink-0">Found</span>
          <div
            className="flex items-center gap-1"
            role="group"
            aria-label={`Quantity of ${item.name} found`}
          >
            <button
              type="button"
              onClick={() => handleStepperChange(partialValue - 1)}
              aria-label={`Decrease found quantity of ${item.name}`}
              disabled={partialValue <= 0}
              className="flex size-6 items-center justify-center rounded-full border border-border bg-background text-muted-foreground hover:bg-muted disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Minus className="size-3" aria-hidden />
            </button>
            <input
              type="number"
              value={partialValue}
              min={0}
              max={requiredQty}
              onChange={(e) => handleStepperChange(Number(e.target.value))}
              aria-label={`Quantity of ${item.name} found`}
              className="w-14 rounded-md border border-border bg-background px-2 py-0.5 text-center text-xs tabular-nums focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
            />
            <button
              type="button"
              onClick={() => handleStepperChange(partialValue + 1)}
              aria-label={`Increase found quantity of ${item.name}`}
              disabled={partialValue >= requiredQty}
              className="flex size-6 items-center justify-center rounded-full border border-border bg-background text-muted-foreground hover:bg-muted disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Plus className="size-3" aria-hidden />
            </button>
          </div>
          {unit ? (
            <span className="text-xs text-muted-foreground shrink-0">{unit}</span>
          ) : null}
          <span className="ml-auto text-xs text-muted-foreground tabular-nums">
            of {requiredQty} {unit}
          </span>
        </div>
      )}

      <ConfirmDialog
        open={showAcquireConfirm}
        title="Mark as fully acquired?"
        description={`You found all ${requiredQty} ${unit} of ${item.name}. Mark it as fully acquired?`}
        confirmLabel="Mark acquired"
        cancelLabel="Keep partial"
        onConfirm={handleConfirmAcquire}
        onCancel={() => setShowAcquireConfirm(false)}
      />
    </div>
  )
}
