'use client'

import { useEffect, useMemo, useState } from 'react'
import { Loader2, Minus, Plus, Refrigerator } from 'lucide-react'
import { useIngredients, useRecipeDetail } from '@weekly-food-planner/supabase/react'
import type { DbTypes, MenuSlotRecord } from '@weekly-food-planner/supabase'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { useSupabase } from '@/lib/hooks/use-supabase'
import { useCreateCookLeftovers } from '@/lib/hooks/use-cook-leftovers'
import { notifyError, notifySuccess } from '@/lib/toast'
import { cn } from '@/lib/utils'

const toNumber = (n: number | string): number => {
  const v = typeof n === 'string' ? Number.parseFloat(n) : n
  return Number.isFinite(v) ? v : 0
}

const round3 = (n: number): number => Math.round(n * 1000) / 1000

type ReconcileRow = {
  recipeIngredientId: string
  ingredientId: string
  name: string
  plannedQty: number
  unit: DbTypes.Unit
  usedQty: number
  addToPantry: boolean
}

export type ReconcileSheetProps = {
  workspaceId: string
  menuId: string | null
  slot: MenuSlotRecord | null
  recipeName: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

// (v2.0 Phase 5) Cook-time reconciliation. Opened when a slot is marked Cooked
// (and re-openable from the "Reconcile / leftovers" affordance on a cooked
// slot). The cook records how much of each ingredient they actually used;
// any remainder (used < planned) is offered back to the pantry as raw stock
// (source 'cook_remainder'). "Skip" creates nothing. Promotes the design-lab
// menu-exec ReconcileSheet onto live recipe data.
export const ReconcileSheet = ({
  workspaceId,
  menuId,
  slot,
  recipeName,
  open,
  onOpenChange,
}: ReconcileSheetProps) => {
  const supabase = useSupabase()
  const [rows, setRows] = useState<ReconcileRow[]>([])

  const recipeQuery = useRecipeDetail({
    supabase,
    workspaceId,
    recipeId: slot?.recipe_id ?? null,
    enabled: open && !!slot,
  })
  const ingredientsQuery = useIngredients({
    supabase,
    enabled: open && !!recipeQuery.data,
  })

  const namesById = useMemo(() => {
    const map: Record<string, string> = {}
    for (const ing of ingredientsQuery.data ?? []) map[ing.id] = ing.name
    return map
  }, [ingredientsQuery.data])

  const recipe = recipeQuery.data

  // Seed the rows once the recipe + ingredient names resolve. Default used ==
  // planned (nothing left over) — the cook decrements where they used less.
  useEffect(() => {
    if (!recipe) {
      setRows([])
      return
    }
    setRows(
      recipe.recipe_ingredients.map((ri) => {
        const planned = round3(toNumber(ri.quantity))
        return {
          recipeIngredientId: ri.id,
          ingredientId: ri.ingredient_id,
          name: namesById[ri.ingredient_id] ?? 'Ingredient',
          plannedQty: planned,
          unit: ri.unit,
          usedQty: planned,
          addToPantry: true,
        }
      }),
    )
  }, [recipe, namesById])

  const createLeftovers = useCreateCookLeftovers({ workspaceId, menuId })

  const setUsed = ({ id, delta }: { id: string; delta: number }) => {
    setRows((prev) =>
      prev.map((r) => {
        if (r.recipeIngredientId !== id) return r
        const next = round3(Math.max(0, Math.min(r.plannedQty, r.usedQty + delta)))
        return { ...r, usedQty: next, addToPantry: next < r.plannedQty }
      }),
    )
  }

  const togglePantry = ({ id }: { id: string }) => {
    setRows((prev) =>
      prev.map((r) =>
        r.recipeIngredientId === id ? { ...r, addToPantry: !r.addToPantry } : r,
      ),
    )
  }

  const hasRemainder = rows.some((r) => r.usedQty < r.plannedQty)

  const handleSkip = () => onOpenChange(false)

  const handleSave = async () => {
    if (!slot) return
    const remainders = rows
      .filter((r) => r.usedQty < r.plannedQty && r.addToPantry)
      .map((r) => ({
        ingredient_id: r.ingredientId,
        quantity: round3(r.plannedQty - r.usedQty),
        unit: r.unit,
      }))

    if (remainders.length === 0) {
      // Nothing to save — treat as Skip.
      onOpenChange(false)
      return
    }

    try {
      await createLeftovers.mutateAsync({
        slotId: slot.id,
        label: recipeName,
        remainders,
      })
      notifySuccess(
        'Leftovers saved',
        `${remainders.length} item${remainders.length === 1 ? '' : 's'} added to your pantry.`,
      )
      onOpenChange(false)
    } catch (err) {
      notifyError(
        'Could not save leftovers',
        err instanceof Error ? err.message : 'Please try again.',
      )
    }
  }

  return (
    <Sheet open={open} onOpenChange={(v) => { if (!v) handleSkip() }}>
      <SheetContent side="right" className="flex w-full flex-col gap-0 sm:max-w-md">
        <SheetHeader className="pb-4">
          <SheetTitle>Used what you planned?</SheetTitle>
          <SheetDescription>
            Record how much of each ingredient you actually used for{' '}
            <strong>{recipeName}</strong>. Any remainder can be saved to your pantry.
          </SheetDescription>
        </SheetHeader>

        <div
          className="flex flex-1 flex-col gap-1 overflow-y-auto py-2"
          role="list"
          aria-label="Ingredient usage"
        >
          {recipeQuery.isLoading ? (
            <>
              <Skeleton className="h-16 w-full rounded-xl" />
              <Skeleton className="h-16 w-full rounded-xl" />
              <Skeleton className="h-16 w-full rounded-xl" />
            </>
          ) : rows.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">
              No ingredients recorded for this recipe.
            </p>
          ) : (
            rows.map((row) => {
              const remainder = round3(row.plannedQty - row.usedQty)
              const checkboxId = `pantry-${row.recipeIngredientId}`
              return (
                <div
                  key={row.recipeIngredientId}
                  role="listitem"
                  className={cn(
                    'flex flex-col gap-2 rounded-xl border border-border bg-card p-3 transition',
                    remainder > 0 && row.addToPantry && 'border-success/30 bg-success-tint/10',
                  )}
                >
                  <div className="flex items-center gap-3">
                    <span className="flex-1 text-sm font-medium">{row.name}</span>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      planned{' '}
                      <span className="font-semibold tabular-nums text-foreground">
                        {row.plannedQty}
                      </span>
                    </span>
                    <div
                      className="flex items-center gap-1"
                      role="group"
                      aria-label={`Used quantity of ${row.name}`}
                    >
                      <button
                        type="button"
                        aria-label={`Decrease used quantity of ${row.name}`}
                        onClick={() => setUsed({ id: row.recipeIngredientId, delta: -1 })}
                        disabled={row.usedQty === 0}
                        className={cn(
                          'flex size-6 items-center justify-center rounded-full border border-border bg-background text-muted-foreground',
                          'hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40',
                          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1',
                        )}
                      >
                        <Minus className="size-3" aria-hidden />
                      </button>
                      <span
                        className="w-10 text-center text-sm font-semibold tabular-nums"
                        aria-live="polite"
                        aria-label={`Used: ${row.usedQty} ${row.unit}`}
                      >
                        {row.usedQty}
                      </span>
                      <button
                        type="button"
                        aria-label={`Increase used quantity of ${row.name}`}
                        onClick={() => setUsed({ id: row.recipeIngredientId, delta: +1 })}
                        disabled={row.usedQty === row.plannedQty}
                        className={cn(
                          'flex size-6 items-center justify-center rounded-full border border-border bg-background text-muted-foreground',
                          'hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40',
                          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1',
                        )}
                      >
                        <Plus className="size-3" aria-hidden />
                      </button>
                    </div>
                  </div>

                  {remainder > 0 && (
                    <div className="flex items-center gap-2 pl-1">
                      <Refrigerator className="size-3.5 shrink-0 text-success" aria-hidden />
                      <span className="flex-1 text-xs text-muted-foreground">
                        {remainder} {row.unit} left — add to pantry
                      </span>
                      <Checkbox
                        id={checkboxId}
                        checked={row.addToPantry}
                        onCheckedChange={() => togglePantry({ id: row.recipeIngredientId })}
                        aria-label={`Add ${remainder} ${row.unit} of ${row.name} to pantry`}
                        className="size-4"
                      />
                      <Label
                        htmlFor={checkboxId}
                        className="cursor-pointer select-none text-xs text-muted-foreground"
                      >
                        Save
                      </Label>
                    </div>
                  )}
                </div>
              )
            })
          )}
        </div>

        {hasRemainder && (
          <p className="px-1 pt-3 text-xs text-muted-foreground">
            Checked remainders will appear in your{' '}
            <span className="font-medium text-foreground">Pantry</span> inventory.
          </p>
        )}

        <SheetFooter className="flex-row gap-2 pt-4">
          <Button
            variant="outline"
            className="flex-1"
            onClick={handleSkip}
            disabled={createLeftovers.isPending}
          >
            Skip
          </Button>
          <Button
            className="flex-1"
            onClick={handleSave}
            disabled={createLeftovers.isPending || rows.length === 0}
          >
            {createLeftovers.isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : null}
            Save leftovers
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
