'use client'

import { AlertTriangle, Calendar, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { type InventoryItemRecord, deriveInventoryDisplayTag } from '@weekly-food-planner/supabase'
import { SourceBadge } from './source-badge'
import { QuantityStepper } from './quantity-stepper'

type InventoryRowProps = {
  item: InventoryItemRecord
  todayYmd: string
  onDecrement: ({ itemId }: { itemId: string }) => void
  onIncrement: ({ itemId }: { itemId: string }) => void
  onMarkConsumed: ({ itemId }: { itemId: string }) => void
  onDelete: ({ itemId }: { itemId: string }) => void
  isPending?: boolean
}

// Returns true when the item expires within 3 days.
const isNearExpiry = (expirationDate: string | null, todayYmd: string): boolean => {
  if (!expirationDate) return false
  const expiryMs = new Date(expirationDate).getTime()
  const todayMs = new Date(todayYmd).getTime()
  const threeDaysMs = 3 * 24 * 60 * 60 * 1000
  return expiryMs - todayMs <= threeDaysMs && expiryMs >= todayMs
}

const isExpired = (expirationDate: string | null, todayYmd: string): boolean => {
  if (!expirationDate) return false
  return expirationDate < todayYmd
}

const formatDate = (isoDate: string | null): string | null => {
  if (!isoDate) return null
  const [y, m, d] = isoDate.split('-')
  if (!y || !m || !d) return isoDate
  return new Date(Number(y), Number(m) - 1, Number(d)).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

export const InventoryRow = ({
  item,
  todayYmd,
  onDecrement,
  onIncrement,
  onMarkConsumed,
  onDelete,
  isPending,
}: InventoryRowProps) => {
  const tag = deriveInventoryDisplayTag({
    source: item.source,
    sourceMenu: item.source_menu,
    todayYmd,
  })

  const nearExpiry = isNearExpiry(item.expiration_date, todayYmd)
  const expired = isExpired(item.expiration_date, todayYmd)
  const ingredientName = item.ingredient?.name ?? 'Unknown ingredient'
  const formattedDate = formatDate(item.expiration_date)

  // Show the "Menu→Pantry graduated" note: a purchase item whose source_menu
  // week has ended and it now reads as 'pantry'.
  const showGraduatedNote =
    item.source === 'purchase' && item.source_menu !== null && tag === 'pantry'

  return (
    <li
      className={cn(
        'flex flex-col gap-2 rounded-xl border border-border bg-card p-3 sm:flex-row sm:items-center sm:gap-4',
        (nearExpiry || expired) && 'border-amber-200/60 bg-amber-50/30 dark:border-amber-800/40 dark:bg-amber-950/20',
      )}
    >
      {/* Name + source badge + near-expiry badge */}
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium">{ingredientName}</span>
          <SourceBadge tag={tag} />
          {(nearExpiry || expired) && (
            <Badge
              variant="outline"
              className="gap-1 border-amber-200 bg-amber-50 text-amber-700 text-xs dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300"
            >
              <AlertTriangle className="size-3" aria-hidden />
              <span>{expired ? 'Expired' : 'Expiring soon'}</span>
            </Badge>
          )}
        </div>

        {/* Graduated Menu→Pantry note */}
        {showGraduatedNote && (
          <span className="text-xs text-muted-foreground">
            Added from menu week of{' '}
            {formatDate(item.source_menu!.week_start_date) ??
              item.source_menu!.week_start_date}
          </span>
        )}

        {/* Optional label */}
        {item.label && !showGraduatedNote && (
          <span className="text-xs text-muted-foreground italic">{item.label}</span>
        )}
      </div>

      {/* Expiry date */}
      <div className="shrink-0">
        {formattedDate ? (
          <span
            className={cn(
              'inline-flex items-center gap-1 text-xs font-medium',
              nearExpiry || expired
                ? 'text-amber-600 dark:text-amber-400'
                : 'text-muted-foreground',
            )}
          >
            {nearExpiry || expired ? (
              <AlertTriangle className="size-3" aria-hidden />
            ) : (
              <Calendar className="size-3" aria-hidden />
            )}
            {nearExpiry && <span className="sr-only">Expiring soon — </span>}
            {expired && <span className="sr-only">Expired — </span>}
            {formattedDate}
          </span>
        ) : (
          <span className="text-xs text-muted-foreground">No expiry</span>
        )}
      </div>

      {/* Quantity stepper */}
      <div className="shrink-0">
        <QuantityStepper
          itemId={item.id}
          ingredientName={ingredientName}
          quantity={item.quantity}
          unit={item.unit}
          onDecrement={onDecrement}
          onIncrement={onIncrement}
          isPending={isPending}
        />
      </div>

      {/* Zero-quantity: "Mark as consumed" / otherwise trash icon */}
      {item.quantity === 0 ? (
        <button
          type="button"
          onClick={() => onMarkConsumed({ itemId: item.id })}
          aria-label={`Mark ${ingredientName} as consumed`}
          disabled={isPending}
          className={cn(
            'shrink-0 rounded-full border border-border px-2.5 py-0.5 text-xs font-medium text-muted-foreground hover:border-destructive hover:text-destructive transition disabled:opacity-50',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
          )}
        >
          Mark as consumed
        </button>
      ) : (
        <button
          type="button"
          aria-label={`Delete ${ingredientName}`}
          onClick={() => onDelete({ itemId: item.id })}
          disabled={isPending}
          className={cn(
            'shrink-0 text-muted-foreground hover:text-destructive transition disabled:opacity-50',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
          )}
        >
          <Trash2 className="size-4" aria-hidden />
        </button>
      )}
    </li>
  )
}
