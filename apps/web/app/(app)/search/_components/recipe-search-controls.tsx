'use client'

import { Search, X } from 'lucide-react'
import type { RecipeRecord } from '@weekly-food-planner/supabase'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

// All recipe search facets in one object so the page holds a single piece of
// state. 'all' is the no-filter sentinel for the dropdown facets.
type MealType = RecipeRecord['meal_type']
type Difficulty = RecipeRecord['difficulty']

export type RecipeSearchFilters = {
  keyword: string
  meal: 'all' | MealType
  cuisine: string
  difficulty: 'all' | Difficulty
  dietaryTag: string
}

export const EMPTY_RECIPE_FILTERS: RecipeSearchFilters = {
  keyword: '',
  meal: 'all',
  cuisine: 'all',
  difficulty: 'all',
  dietaryTag: 'all',
}

const MEALS: Array<{ value: 'all' | MealType; label: string }> = [
  { value: 'all', label: 'All meals' },
  { value: 'breakfast', label: 'Breakfast' },
  { value: 'lunch', label: 'Lunch' },
  { value: 'dinner', label: 'Dinner' },
  { value: 'snack', label: 'Snack' },
]

const DIFFICULTIES: Array<{ value: 'all' | Difficulty; label: string }> = [
  { value: 'all', label: 'Any difficulty' },
  { value: 'easy', label: 'Easy' },
  { value: 'medium', label: 'Medium' },
  { value: 'hard', label: 'Hard' },
]

export const hasActiveRecipeFilters = (f: RecipeSearchFilters): boolean =>
  f.keyword.trim() !== '' ||
  f.meal !== 'all' ||
  f.cuisine !== 'all' ||
  f.difficulty !== 'all' ||
  f.dietaryTag !== 'all'

type RecipeSearchControlsProps = {
  filters: RecipeSearchFilters
  cuisines: string[]
  dietaryTags: string[]
  onChange: ({ filters }: { filters: RecipeSearchFilters }) => void
}

export const RecipeSearchControls = ({
  filters,
  cuisines,
  dietaryTags,
  onChange,
}: RecipeSearchControlsProps) => {
  const patch = (next: Partial<RecipeSearchFilters>) =>
    onChange({ filters: { ...filters, ...next } })

  return (
    <div className="flex flex-col gap-3">
      {/* Keyword */}
      <label className="relative flex items-center">
        <span className="sr-only">Search recipes by name</span>
        <Search
          className="pointer-events-none absolute left-3 size-4 text-muted-foreground"
          aria-hidden
        />
        <input
          type="search"
          autoFocus
          placeholder="Search recipes by name…"
          value={filters.keyword}
          onChange={(e) => patch({ keyword: e.target.value })}
          className={cn(
            'h-11 w-full rounded-pill border border-border bg-background pl-10 pr-10 text-sm shadow-sm',
            'placeholder:text-muted-foreground',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
          )}
        />
        {filters.keyword ? (
          <button
            type="button"
            aria-label="Clear keyword"
            onClick={() => patch({ keyword: '' })}
            className="absolute right-3 text-muted-foreground hover:text-foreground"
          >
            <X className="size-4" />
          </button>
        ) : null}
      </label>

      {/* Facet dropdowns */}
      <div className="flex flex-wrap items-center gap-2">
        <Select
          value={filters.meal}
          onValueChange={(v) => patch({ meal: v as RecipeSearchFilters['meal'] })}
        >
          <SelectTrigger className="h-9 w-auto gap-2 rounded-pill" aria-label="Meal">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {MEALS.map((m) => (
              <SelectItem key={m.value} value={m.value}>
                {m.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={filters.difficulty}
          onValueChange={(v) =>
            patch({ difficulty: v as RecipeSearchFilters['difficulty'] })
          }
        >
          <SelectTrigger
            className="h-9 w-auto gap-2 rounded-pill"
            aria-label="Difficulty"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {DIFFICULTIES.map((d) => (
              <SelectItem key={d.value} value={d.value}>
                {d.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {cuisines.length > 0 ? (
          <Select
            value={filters.cuisine}
            onValueChange={(v) => patch({ cuisine: v })}
          >
            <SelectTrigger
              className="h-9 w-auto gap-2 rounded-pill"
              aria-label="Cuisine"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Any cuisine</SelectItem>
              {cuisines.map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : null}

        {dietaryTags.length > 0 ? (
          <Select
            value={filters.dietaryTag}
            onValueChange={(v) => patch({ dietaryTag: v })}
          >
            <SelectTrigger
              className="h-9 w-auto gap-2 rounded-pill"
              aria-label="Dietary tag"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Any dietary tag</SelectItem>
              {dietaryTags.map((t) => (
                <SelectItem key={t} value={t}>
                  {t.replace(/_/g, ' ')}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : null}

        {hasActiveRecipeFilters(filters) ? (
          <Button
            variant="ghost"
            size="sm"
            className="h-9 rounded-pill text-muted-foreground"
            onClick={() => onChange({ filters: EMPTY_RECIPE_FILTERS })}
          >
            <X className="size-4" />
            Clear all
          </Button>
        ) : null}
      </div>
    </div>
  )
}
