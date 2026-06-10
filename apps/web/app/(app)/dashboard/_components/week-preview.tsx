'use client'

import Link from 'next/link'
import { Skeleton } from '@/components/ui/skeleton'
import type { MenuRecord, RecipeRecord } from '@weekly-food-planner/supabase'
import { resolveRecipeIcon } from './recipe-icon'

// Canonical day order so the scroll strip is always Monday → Sunday.
const DAY_ORDER = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
]

// Short labels for the strip.
const DAY_SHORT: Record<string, string> = {
  monday: 'Mon',
  tuesday: 'Tue',
  wednesday: 'Wed',
  thursday: 'Thu',
  friday: 'Fri',
  saturday: 'Sat',
  sunday: 'Sun',
}

// Meal priority: prefer dinner, then lunch, then breakfast, then first slot.
const MEAL_PRIORITY = ['dinner', 'lunch', 'breakfast', 'snack']

type WeekPreviewProps = {
  menu: MenuRecord
  recipesById: Record<string, RecipeRecord>
  isLoadingRecipes: boolean
}

export const WeekPreview = ({
  menu,
  recipesById,
  isLoadingRecipes,
}: WeekPreviewProps) => {
  // Group slots by day_of_week, then pick the representative recipe per day.
  const dayMap = new Map<string, string>() // day → recipe_id

  for (const slot of menu.menu_slots) {
    const day = slot.day_of_week.toLowerCase()
    const existing = dayMap.get(day)
    if (!existing) {
      dayMap.set(day, slot.recipe_id)
    } else {
      // Prefer a higher-priority meal type.
      const currentMealPriority = MEAL_PRIORITY.indexOf(
        (slot.meal_type ?? '').toLowerCase(),
      )
      // Find what meal type the current "best" slot has by scanning for it.
      const existingSlot = menu.menu_slots.find(
        (s) =>
          s.day_of_week.toLowerCase() === day && s.recipe_id === existing,
      )
      const existingPriority = existingSlot
        ? MEAL_PRIORITY.indexOf((existingSlot.meal_type ?? '').toLowerCase())
        : Infinity
      if (
        currentMealPriority !== -1 &&
        (existingPriority === -1 || currentMealPriority < existingPriority)
      ) {
        dayMap.set(day, slot.recipe_id)
      }
    }
  }

  // Produce an ordered array respecting DAY_ORDER, only days that appear.
  const days = DAY_ORDER.filter((d) => dayMap.has(d))

  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-md sm:col-span-2 lg:col-span-3">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="font-semibold">This week</h3>
        <Link
          href="/menu"
          className="text-sm text-accent-strong transition-opacity hover:opacity-80"
        >
          View menu →
        </Link>
      </div>

      {isLoadingRecipes ? (
        <div className="flex gap-3 overflow-x-auto pb-1">
          {[1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-28 w-28 shrink-0 rounded-2xl" />
          ))}
        </div>
      ) : days.length === 0 ? (
        <p className="text-sm text-muted-foreground">No slots planned yet.</p>
      ) : (
        <div className="flex gap-3 overflow-x-auto pb-1">
          {days.map((day) => {
            const recipeId = dayMap.get(day)!
            const recipe = recipesById[recipeId]
            const icon = recipe
              ? resolveRecipeIcon({
                  name: recipe.name,
                  cuisine: recipe.cuisine,
                  tags: recipe.recipe_dietary_tags.map((t) => t.tag),
                  meal: recipe.meal_type,
                })
              : '🍽️'
            const recipeName = recipe?.name ?? 'Recipe'

            return (
              <Link
                key={day}
                href="/menu"
                className="flex w-28 shrink-0 flex-col gap-2 rounded-2xl border border-border bg-background p-3 text-left transition-colors hover:border-primary/40 hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <span className="text-xs font-medium text-muted-foreground">
                  {DAY_SHORT[day] ?? day}
                </span>
                <div className="flex aspect-square w-full items-center justify-center rounded-xl bg-muted text-3xl">
                  {icon}
                </div>
                <span className="line-clamp-2 text-xs font-medium leading-tight">
                  {recipeName}
                </span>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
