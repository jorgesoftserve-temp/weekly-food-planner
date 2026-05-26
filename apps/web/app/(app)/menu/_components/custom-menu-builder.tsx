'use client'

import { useMemo, useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { useRecipesList } from '@weekly-food-planner/supabase/react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { useSupabase } from '@/lib/hooks/use-supabase'
import { RecipeForm } from '@/app/(app)/recipes/_components/recipe-form'

type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack'

const MEAL_TYPES: MealType[] = ['breakfast', 'lunch', 'dinner', 'snack']

const DAYS_OF_WEEK = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
] as const

const DAY_BY_JS_INDEX = [
  'sunday',
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
] as const

// Walk forward N consecutive days starting from weekStartDate's day-of-week,
// wrapping past Sunday → Monday. Mirrors the engine's enumerateMenuDays
// without pulling the package in just for one helper.
const enumerateDays = (weekStartDate: string, durationDays: number): string[] => {
  const [y, m, d] = weekStartDate.split('-').map((p) => Number.parseInt(p, 10))
  if (!y || !m || !d) return [...DAYS_OF_WEEK].slice(0, durationDays)
  const startIdx = DAYS_OF_WEEK.indexOf(
    DAY_BY_JS_INDEX[new Date(y, m - 1, d).getDay()] as
      | (typeof DAYS_OF_WEEK)[number]
      | undefined ??
      'monday',
  )
  const days: string[] = []
  const safeStart = startIdx < 0 ? 0 : startIdx
  const clamped = Math.max(1, Math.min(7, Math.floor(durationDays)))
  for (let i = 0; i < clamped; i++) {
    const day = DAYS_OF_WEEK[(safeStart + i) % 7]
    if (day) days.push(day)
  }
  return days
}

export type CustomBuilderSlot = {
  // Client-only id for React keys. Not sent to the server.
  clientId: string
  dayOfWeek: string
  mealKey: string
  mealType: MealType
  recipeId: string
  targetMemberId: null
}

const makeClientId = (): string =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`

// Stable mealKey per (day, mealType, occurrence) so the user can put
// "2 breakfasts" on Monday and the menu_slots unique constraint is happy.
const reassignMealKeys = (slots: CustomBuilderSlot[]): CustomBuilderSlot[] => {
  const counters = new Map<string, number>()
  return slots.map((slot) => {
    const k = `${slot.dayOfWeek}::${slot.mealType}`
    const idx = counters.get(k) ?? 0
    counters.set(k, idx + 1)
    const mealKey = idx === 0 ? slot.mealType : `${slot.mealType}_${idx + 1}`
    return { ...slot, mealKey }
  })
}

export type CustomMenuBuilderProps = {
  workspaceId: string
  weekStartDate: string
  durationDays: number
  slots: CustomBuilderSlot[]
  onChange: (next: CustomBuilderSlot[]) => void
}

export const CustomMenuBuilder = ({
  workspaceId,
  weekStartDate,
  durationDays,
  slots,
  onChange,
}: CustomMenuBuilderProps) => {
  const supabase = useSupabase()
  const recipesQuery = useRecipesList({
    supabase,
    workspaceId,
    enabled: true,
  })
  const recipes = recipesQuery.data ?? []
  const days = useMemo(
    () => enumerateDays(weekStartDate, durationDays),
    [weekStartDate, durationDays],
  )
  const [createOpen, setCreateOpen] = useState(false)

  const recipesByMealType = useMemo(() => {
    const map: Record<MealType, typeof recipes> = {
      breakfast: [],
      lunch: [],
      dinner: [],
      snack: [],
    }
    for (const r of recipes) map[r.meal_type as MealType]?.push(r)
    return map
  }, [recipes])

  const addSlot = () => {
    const defaultDay = days[0] ?? 'monday'
    const defaultMealType: MealType = 'breakfast'
    const next: CustomBuilderSlot = {
      clientId: makeClientId(),
      dayOfWeek: defaultDay,
      mealKey: defaultMealType,
      mealType: defaultMealType,
      recipeId: '',
      targetMemberId: null,
    }
    onChange(reassignMealKeys([...slots, next]))
  }

  const updateSlot = (clientId: string, patch: Partial<CustomBuilderSlot>) => {
    onChange(
      reassignMealKeys(
        slots.map((s) => (s.clientId === clientId ? { ...s, ...patch } : s)),
      ),
    )
  }

  const removeSlot = (clientId: string) => {
    onChange(
      reassignMealKeys(slots.filter((s) => s.clientId !== clientId)),
    )
  }

  return (
    <div className="flex flex-col gap-3 rounded-md border border-border bg-card/40 p-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex flex-col">
          <h3 className="text-sm font-semibold">Custom slots</h3>
          <p className="text-xs text-muted-foreground">
            Build any number of meals. Add 2 breakfasts on the same day if you
            want, or skip days entirely.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setCreateOpen(true)}
        >
          <Plus className="size-4" />
          New recipe
        </Button>
      </div>

      {slots.length === 0 ? (
        <p className="rounded-md border border-dashed border-border bg-card/60 px-3 py-4 text-center text-xs text-muted-foreground">
          No meals yet. Click &quot;Add meal&quot; to start.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {slots.map((slot) => {
            const candidates = recipesByMealType[slot.mealType] ?? []
            return (
              <li
                key={slot.clientId}
                className="grid grid-cols-1 gap-2 rounded-md border border-border bg-background p-2 sm:grid-cols-[1fr_1fr_2fr_auto]"
              >
                <div className="flex flex-col gap-1">
                  <Label className="text-xs">Day</Label>
                  <Select
                    value={slot.dayOfWeek}
                    onValueChange={(value) =>
                      updateSlot(slot.clientId, { dayOfWeek: value })
                    }
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {days.map((day) => (
                        <SelectItem key={day} value={day}>
                          <span className="capitalize">{day}</span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex flex-col gap-1">
                  <Label className="text-xs">Meal</Label>
                  <Select
                    value={slot.mealType}
                    onValueChange={(value) =>
                      updateSlot(slot.clientId, {
                        mealType: value as MealType,
                        // Reset recipe when meal type changes since the
                        // candidate list flips entirely.
                        recipeId: '',
                      })
                    }
                  >
                    <SelectTrigger className="h-8 text-xs capitalize">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {MEAL_TYPES.map((t) => (
                        <SelectItem key={t} value={t} className="capitalize">
                          {t}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex flex-col gap-1">
                  <Label className="text-xs">Recipe</Label>
                  <Select
                    value={slot.recipeId || undefined}
                    onValueChange={(value) =>
                      updateSlot(slot.clientId, { recipeId: value })
                    }
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue placeholder="Pick a recipe…" />
                    </SelectTrigger>
                    <SelectContent>
                      {candidates.length === 0 ? (
                        <div className="px-2 py-1.5 text-xs text-muted-foreground">
                          No {slot.mealType} recipes — create one above.
                        </div>
                      ) : (
                        candidates.map((r) => (
                          <SelectItem key={r.id} value={r.id}>
                            {r.name}
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-end justify-end">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => removeSlot(slot.clientId)}
                    aria-label="Remove slot"
                    className="size-8"
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </li>
            )
          })}
        </ul>
      )}

      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={addSlot}
        className="self-start"
      >
        <Plus className="size-4" />
        Add meal
      </Button>

      <Sheet open={createOpen} onOpenChange={setCreateOpen}>
        <SheetContent
          side="right"
          className="flex w-full flex-col gap-0 p-0 sm:max-w-2xl"
        >
          <SheetHeader className="border-b border-border px-6 py-4">
            <SheetTitle>New recipe</SheetTitle>
            <SheetDescription>
              Saved to this workspace and immediately available in the custom
              menu picker.
            </SheetDescription>
          </SheetHeader>
          <div className="flex-1 overflow-y-auto px-6 py-6">
            <RecipeForm
              mode="create"
              workspaceId={workspaceId}
              onClose={() => setCreateOpen(false)}
            />
          </div>
        </SheetContent>
      </Sheet>
    </div>
  )
}
