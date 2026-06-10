'use client'

import { Search, X } from 'lucide-react'
import { cn } from '@/lib/utils'

// The full set of quick-filter values the recipes page supports.
// 'All' is the "no filter" sentinel.
export const RECIPE_FILTERS = [
  'All',
  'Breakfast',
  'Lunch',
  'Dinner',
  'Snack',
] as const

export type RecipeFilter = (typeof RECIPE_FILTERS)[number]

type RecipeFilterBarProps = {
  search: string
  activeFilter: RecipeFilter
  onSearch: ({ value }: { value: string }) => void
  onFilter: ({ filter }: { filter: RecipeFilter }) => void
}

export const RecipeFilterBar = ({
  search,
  activeFilter,
  onSearch,
  onFilter,
}: RecipeFilterBarProps) => {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* Inline search input */}
      <label className="relative flex items-center">
        <span className="sr-only">Search recipes</span>
        <Search
          className="pointer-events-none absolute left-3 size-4 text-muted-foreground"
          aria-hidden="true"
        />
        <input
          type="search"
          placeholder="Search recipes…"
          value={search}
          onChange={(e) => onSearch({ value: e.target.value })}
          className={cn(
            'h-9 rounded-pill border border-border bg-background pl-9 pr-8 text-sm',
            'placeholder:text-muted-foreground',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
          )}
        />
        {search ? (
          <button
            type="button"
            aria-label="Clear search"
            onClick={() => onSearch({ value: '' })}
            className="absolute right-2.5 text-muted-foreground hover:text-foreground"
          >
            <X className="size-3.5" />
          </button>
        ) : null}
      </label>

      {/* Meal-type filter chips */}
      {RECIPE_FILTERS.map((f) => {
        const isActive = activeFilter === f
        return (
          <button
            key={f}
            type="button"
            aria-pressed={isActive}
            onClick={() => onFilter({ filter: f })}
            className={cn(
              'rounded-pill px-3 py-1.5 text-sm transition-colors',
              isActive
                ? 'bg-accent-tint font-medium text-accent-strong'
                : 'border border-border text-muted-foreground hover:bg-muted',
            )}
          >
            {f}
          </button>
        )
      })}
    </div>
  )
}
