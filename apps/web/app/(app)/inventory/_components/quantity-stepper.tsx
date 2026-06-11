'use client'

import { Minus, Plus } from 'lucide-react'
import { cn } from '@/lib/utils'

export const QuantityStepper = ({
  itemId,
  ingredientName,
  quantity,
  unit,
  onDecrement,
  onIncrement,
  isPending,
}: {
  itemId: string
  ingredientName: string
  quantity: number
  unit: string
  onDecrement: ({ itemId }: { itemId: string }) => void
  onIncrement: ({ itemId }: { itemId: string }) => void
  isPending?: boolean
}) => (
  <div className="flex items-center gap-1.5">
    <button
      type="button"
      aria-label={`Decrease quantity of ${ingredientName}`}
      disabled={isPending}
      onClick={() => onDecrement({ itemId })}
      className={cn(
        'flex size-6 items-center justify-center rounded-full border border-border bg-background text-muted-foreground hover:bg-muted disabled:opacity-50',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
      )}
    >
      <Minus className="size-3" aria-hidden />
    </button>
    <span className="min-w-[3.5rem] text-center text-sm font-medium tabular-nums">
      {quantity} {unit}
    </span>
    <button
      type="button"
      aria-label={`Increase quantity of ${ingredientName}`}
      disabled={isPending}
      onClick={() => onIncrement({ itemId })}
      className={cn(
        'flex size-6 items-center justify-center rounded-full border border-border bg-background text-muted-foreground hover:bg-muted disabled:opacity-50',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
      )}
    >
      <Plus className="size-3" aria-hidden />
    </button>
  </div>
)
