'use client'

import { useMemo } from 'react'
import type { MenuRecord } from '@weekly-food-planner/supabase'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'

const DAY_ORDER: Record<string, number> = {
  monday: 0,
  tuesday: 1,
  wednesday: 2,
  thursday: 3,
  friday: 4,
  saturday: 5,
  sunday: 6,
}

const capitalize = (s: string): string =>
  s.length === 0 ? s : s.charAt(0).toUpperCase() + s.slice(1)

export type ActiveMenuViewProps = {
  menu: MenuRecord
  recipeNamesById: Record<string, string>
}

export const ActiveMenuView = ({
  menu,
  recipeNamesById,
}: ActiveMenuViewProps) => {
  const slotsByDay = useMemo(() => {
    const map = new Map<string, typeof menu.menu_slots>()
    for (const slot of menu.menu_slots) {
      const list = map.get(slot.day_of_week) ?? []
      list.push(slot)
      map.set(slot.day_of_week, list)
    }
    // Sort within each day by meal_key for a stable visual order.
    for (const [, list] of map) {
      list.sort((a, b) => a.meal_key.localeCompare(b.meal_key))
    }
    const entries = Array.from(map.entries())
    entries.sort(
      ([a], [b]) => (DAY_ORDER[a] ?? 99) - (DAY_ORDER[b] ?? 99),
    )
    return entries
  }, [menu.menu_slots])

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-md border border-border bg-card/40 px-4 py-3 text-sm text-muted-foreground">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
          <span>
            <span className="font-medium text-foreground">Week starting:</span>{' '}
            {menu.week_start_date}
          </span>
          <span>
            <span className="font-medium text-foreground">Seed:</span>{' '}
            <code className="rounded bg-muted px-1 py-0.5 text-xs">
              {menu.seed}
            </code>
          </span>
          <span>
            <span className="font-medium text-foreground">Inputs hash:</span>{' '}
            <code className="rounded bg-muted px-1 py-0.5 text-xs">
              {menu.inputs_hash.slice(0, 12)}…
            </code>
          </span>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {slotsByDay.map(([day, slots]) => (
          <Card key={day}>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">{capitalize(day)}</CardTitle>
              <CardDescription>
                {slots.length} {slots.length === 1 ? 'meal' : 'meals'}
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
              {slots.map((slot) => {
                const recipeName =
                  recipeNamesById[slot.recipe_id] ??
                  `[unknown:${slot.recipe_id.slice(0, 6)}]`
                return (
                  <div
                    key={slot.id}
                    className="flex flex-col gap-0.5 rounded-md border border-border p-2"
                  >
                    <span className="text-xs uppercase tracking-wide text-muted-foreground">
                      {slot.meal_key}
                    </span>
                    <span className="text-sm font-medium">{recipeName}</span>
                  </div>
                )
              })}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
