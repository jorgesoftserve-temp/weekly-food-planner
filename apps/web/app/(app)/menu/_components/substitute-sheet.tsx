'use client'

import { useEffect, useMemo, useState } from 'react'
import { ArrowLeftRight, CheckCircle2, Loader2, RotateCcw } from 'lucide-react'
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
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { IngredientPicker } from '@/components/forms/ingredient-picker'
import { useSupabase } from '@/lib/hooks/use-supabase'
import {
  useDeleteSlotIngredientOverride,
  useSetSlotIngredientOverride,
} from '@/lib/hooks/use-slot-ingredient-overrides'
import { notifyError, notifySuccess } from '@/lib/toast'
import { cn } from '@/lib/utils'

type Unit = DbTypes.Unit

const toNumber = (n: number | string): number => {
  const v = typeof n === 'string' ? Number.parseFloat(n) : n
  return Number.isFinite(v) ? v : 0
}

// recipe_ingredients.substitutions is JSONB (unknown) — coerce to the catalog shape.
const parseSubstitutions = (
  raw: unknown,
): Array<{ ingredient_id: string; note?: string }> => {
  if (!Array.isArray(raw)) return []
  return raw.filter(
    (s): s is { ingredient_id: string; note?: string } =>
      !!s && typeof s === 'object' && typeof (s as { ingredient_id?: unknown }).ingredient_id === 'string',
  )
}

export type SubstituteSheetProps = {
  workspaceId: string
  menuId: string | null
  slot: MenuSlotRecord | null
  recipeName: string
  /** Existing overrides for THIS slot, keyed by original_ingredient_id. */
  overridesByOriginal: Record<
    string,
    { substitute_ingredient_id: string; quantity: number | null; unit: Unit | null }
  >
  open: boolean
  onOpenChange: (open: boolean) => void
}

// (v2.0 Phase 6) Substitute an ingredient for one accepted-menu slot only. The
// recipe is unchanged; the grocery list reflects the swap; the menu's seed /
// identity are untouched. Suggested substitutes come from the recipe ingredient's
// own `substitutions` catalog; free choice via the shared IngredientPicker. The
// route validates the substitute against the slot's eater(s) before saving.
// Promotes the design-lab menu-exec SubstitutionControl onto live recipe data.
export const SubstituteSheet = ({
  workspaceId,
  menuId,
  slot,
  recipeName,
  overridesByOriginal,
  open,
  onOpenChange,
}: SubstituteSheetProps) => {
  const supabase = useSupabase()
  const [selectedOriginal, setSelectedOriginal] = useState<string | null>(null)
  const [substituteId, setSubstituteId] = useState<string | null>(null)
  const [qtyText, setQtyText] = useState('')
  // Inline form error (invalid qty, or the 422 allergen/exclusion rejection from
  // the route) — shown in the sheet so the user can fix it without it closing.
  const [formError, setFormError] = useState<string | null>(null)

  const recipeQuery = useRecipeDetail({
    supabase,
    workspaceId,
    recipeId: slot?.recipe_id ?? null,
    enabled: open && !!slot,
  })
  const ingredientsQuery = useIngredients({ supabase, enabled: open })

  const namesById = useMemo(() => {
    const map: Record<string, string> = {}
    for (const ing of ingredientsQuery.data ?? []) map[ing.id] = ing.name
    return map
  }, [ingredientsQuery.data])

  const recipe = recipeQuery.data
  const nameOf = (id: string): string => namesById[id] ?? 'Ingredient'

  // Reset selection whenever a different slot opens.
  useEffect(() => {
    if (open) {
      setSelectedOriginal(null)
      setSubstituteId(null)
      setQtyText('')
      setFormError(null)
    }
  }, [open, slot?.id])

  const selectedIngredient = useMemo(
    () =>
      recipe?.recipe_ingredients.find((ri) => ri.ingredient_id === selectedOriginal) ?? null,
    [recipe, selectedOriginal],
  )

  const suggested = useMemo(
    () => parseSubstitutions(selectedIngredient?.substitutions),
    [selectedIngredient],
  )

  const setMutation = useSetSlotIngredientOverride({ workspaceId, menuId })
  const deleteMutation = useDeleteSlotIngredientOverride({ workspaceId, menuId })
  const isPending = setMutation.isPending || deleteMutation.isPending

  const chooseOriginal = (originalId: string) => {
    setSelectedOriginal(originalId)
    const existing = overridesByOriginal[originalId]
    setSubstituteId(existing?.substitute_ingredient_id ?? null)
    setQtyText(existing?.quantity != null ? String(existing.quantity) : '')
    setFormError(null)
  }

  const chooseSubstitute = (id: string) => {
    setSubstituteId(id)
    // Clear a prior allergen/validation error — the user is changing the choice.
    setFormError(null)
  }

  const handleApply = async () => {
    if (!slot || !selectedOriginal || !substituteId) return
    const qty = qtyText.trim() === '' ? null : Number.parseFloat(qtyText)
    if (qty != null && (!Number.isFinite(qty) || qty < 0)) {
      setFormError('Enter a quantity of 0 or more, or leave it blank to keep the recipe amount.')
      return
    }
    setFormError(null)
    try {
      await setMutation.mutateAsync({
        slotId: slot.id,
        original_ingredient_id: selectedOriginal,
        substitute_ingredient_id: substituteId,
        quantity: qty,
        unit: selectedIngredient ? (selectedIngredient.unit as Unit) : null,
      })
      notifySuccess(
        'Ingredient substituted',
        `${nameOf(selectedOriginal)} → ${nameOf(substituteId)}. Grocery list updated.`,
      )
      onOpenChange(false)
    } catch (err) {
      // Keep the sheet open and surface the reason inline (e.g. the 422
      // allergen/exclusion rejection) so the user can pick another substitute.
      setFormError(err instanceof Error ? err.message : 'Could not substitute. Please try again.')
    }
  }

  const handleRemove = async () => {
    if (!slot || !selectedOriginal) return
    try {
      await deleteMutation.mutateAsync({
        slotId: slot.id,
        original_ingredient_id: selectedOriginal,
      })
      notifySuccess('Substitution removed', `${nameOf(selectedOriginal)} restored.`)
      onOpenChange(false)
    } catch (err) {
      notifyError(
        'Could not remove',
        err instanceof Error ? err.message : 'Please try again.',
      )
    }
  }

  const hasExistingOverride = selectedOriginal != null && !!overridesByOriginal[selectedOriginal]

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex w-full flex-col gap-0 overflow-y-auto sm:max-w-md">
        <SheetHeader className="pb-4">
          <SheetTitle>Substitute an ingredient</SheetTitle>
          <SheetDescription>
            Swap an ingredient for <strong>{recipeName}</strong> on this menu only. The
            recipe stays the same; your grocery list updates.
          </SheetDescription>
        </SheetHeader>

        <div className="flex flex-1 flex-col gap-5 py-2">
          {recipeQuery.isLoading ? (
            <>
              <Skeleton className="h-10 w-full rounded-lg" />
              <Skeleton className="h-10 w-full rounded-lg" />
              <Skeleton className="h-10 w-full rounded-lg" />
            </>
          ) : !recipe || recipe.recipe_ingredients.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">
              This recipe has no ingredients to substitute.
            </p>
          ) : (
            <>
              {/* Step 1 — pick which ingredient to substitute */}
              <section className="flex flex-col gap-1.5">
                <span className="text-xs font-medium text-muted-foreground">
                  Which ingredient?
                </span>
                <div
                  className="flex flex-col gap-1"
                  role="group"
                  aria-label="Recipe ingredients"
                >
                  {recipe.recipe_ingredients.map((ri) => {
                    const isSelected = ri.ingredient_id === selectedOriginal
                    const existing = overridesByOriginal[ri.ingredient_id]
                    return (
                      <button
                        key={ri.id}
                        type="button"
                        aria-pressed={isSelected}
                        onClick={() => chooseOriginal(ri.ingredient_id)}
                        className={cn(
                          'flex items-center gap-2 rounded-lg border px-3 py-2 text-left text-sm transition',
                          isSelected
                            ? 'border-primary bg-accent-tint/40'
                            : 'border-border bg-background hover:bg-muted',
                        )}
                      >
                        <span className="flex-1">
                          <span className="font-medium text-foreground">
                            {nameOf(ri.ingredient_id)}
                          </span>
                          <span className="ml-1 text-xs text-muted-foreground">
                            {toNumber(ri.quantity)} {ri.unit}
                          </span>
                        </span>
                        {existing ? (
                          <span className="flex items-center gap-1 rounded-full bg-success-tint px-2 py-0.5 text-[10px] font-medium uppercase text-success">
                            <ArrowLeftRight className="size-2.5" aria-hidden />
                            {nameOf(existing.substitute_ingredient_id)}
                          </span>
                        ) : null}
                      </button>
                    )
                  })}
                </div>
              </section>

              {/* Step 2 — choose the substitute */}
              {selectedOriginal ? (
                <section className="flex flex-col gap-3 rounded-xl border border-border bg-muted/40 p-3">
                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    <span className="rounded-full bg-destructive/10 px-2 py-0.5 text-xs font-medium text-destructive line-through">
                      {nameOf(selectedOriginal)}
                    </span>
                    <ArrowLeftRight className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
                    <span className="rounded-full bg-success-tint px-2 py-0.5 text-xs font-medium text-success">
                      {substituteId ? nameOf(substituteId) : '—'}
                    </span>
                  </div>

                  {suggested.length > 0 ? (
                    <div className="flex flex-col gap-1.5">
                      <span className="text-xs font-medium text-muted-foreground">
                        Suggested substitutes
                      </span>
                      {suggested.map((s) => {
                        const isSel = s.ingredient_id === substituteId
                        return (
                          <button
                            key={s.ingredient_id}
                            type="button"
                            onClick={() => chooseSubstitute(s.ingredient_id)}
                            aria-pressed={isSel}
                            className={cn(
                              'flex items-start gap-2 rounded-lg border px-3 py-2 text-left text-sm transition',
                              isSel
                                ? 'border-success/40 bg-success-tint/30 text-foreground'
                                : 'border-border bg-background text-muted-foreground hover:bg-muted',
                            )}
                          >
                            <span className="flex-1">
                              <span className="block font-medium text-foreground">
                                {nameOf(s.ingredient_id)}
                              </span>
                              {s.note ? (
                                <span className="text-xs text-muted-foreground">{s.note}</span>
                              ) : null}
                            </span>
                            {isSel ? (
                              <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" aria-hidden />
                            ) : null}
                          </button>
                        )
                      })}
                    </div>
                  ) : null}

                  <div className="flex flex-col gap-1.5">
                    <span className="text-xs font-medium text-muted-foreground">
                      Or pick any ingredient
                    </span>
                    <IngredientPicker
                      value={substituteId}
                      onChange={(next) => chooseSubstitute(next)}
                    />
                  </div>

                  <div className="flex items-center gap-2">
                    <Label htmlFor="sub-qty" className="shrink-0 text-xs text-muted-foreground">
                      Quantity
                      {selectedIngredient ? ` (${selectedIngredient.unit})` : ''}
                    </Label>
                    <Input
                      id="sub-qty"
                      type="number"
                      min={0}
                      step="any"
                      inputMode="decimal"
                      value={qtyText}
                      onChange={(e) => {
                        setQtyText(e.target.value)
                        if (formError) setFormError(null)
                      }}
                      aria-invalid={formError != null}
                      aria-describedby={formError ? 'sub-error' : undefined}
                      placeholder={
                        selectedIngredient
                          ? `${toNumber(selectedIngredient.quantity)} (keep)`
                          : 'keep recipe amount'
                      }
                      className="h-8 w-32 text-sm"
                    />
                  </div>
                </section>
              ) : null}
            </>
          )}
        </div>

        {formError ? (
          <p
            id="sub-error"
            role="alert"
            className="pt-3 text-sm text-destructive"
          >
            {formError}
          </p>
        ) : null}

        <SheetFooter className="flex-row gap-2 pt-4">
          {hasExistingOverride ? (
            <Button
              variant="outline"
              className="flex-1"
              onClick={handleRemove}
              disabled={isPending}
            >
              {deleteMutation.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <RotateCcw className="size-4" />
              )}
              Remove
            </Button>
          ) : (
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => onOpenChange(false)}
              disabled={isPending}
            >
              Cancel
            </Button>
          )}
          <Button
            className="flex-1"
            onClick={handleApply}
            disabled={isPending || !selectedOriginal || !substituteId}
          >
            {setMutation.isPending ? <Loader2 className="size-4 animate-spin" /> : null}
            Apply substitution
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
