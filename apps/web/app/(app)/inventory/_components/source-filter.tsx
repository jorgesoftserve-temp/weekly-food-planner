'use client'

import { cn } from '@/lib/utils'

export type InventoryFilterKey = 'all' | 'pantry' | 'menu' | 'leftover'

const FILTERS: { key: InventoryFilterKey; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'pantry', label: 'Pantry' },
  { key: 'menu', label: 'Menu' },
  { key: 'leftover', label: 'Leftover' },
]

export const SourceFilter = ({
  activeFilter,
  onFilter,
}: {
  activeFilter: InventoryFilterKey
  onFilter: ({ filter }: { filter: InventoryFilterKey }) => void
}) => (
  <div className="flex flex-wrap gap-2" role="group" aria-label="Filter by source">
    {FILTERS.map((f) => (
      <button
        key={f.key}
        type="button"
        aria-pressed={activeFilter === f.key}
        onClick={() => onFilter({ filter: f.key })}
        className={cn(
          'rounded-full px-3.5 py-1 text-sm font-medium transition',
          activeFilter === f.key
            ? 'bg-accent-tint text-accent-strong'
            : 'border border-border text-muted-foreground hover:bg-muted',
        )}
      >
        {f.label}
      </button>
    ))}
  </div>
)
