'use client'

import { useMemo, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { useRecipesList } from '@weekly-food-planner/supabase/react'
import type {
  DbTypes,
  MenuSlotRecord,
  RecipeRecord,
} from '@weekly-food-planner/supabase'

type MealType = DbTypes.MealType
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { useReplaceMenuSlot } from '@/lib/hooks/use-menu-draft'
import { useSupabase } from '@/lib/hooks/use-supabase'
import { notifyError, notifySuccess } from '@/lib/toast'

const capitalize = (s: string): string =>
  s.length === 0 ? s : s.charAt(0).toUpperCase() + s.slice(1)

export type ReplaceSlotDialogProps = {
  workspaceId: string
  menuId: string | null
  slot: MenuSlotRecord | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

// Picker for a draft slot's recipe. Candidates are filtered client-side to
// recipes that match the slot's meal_type. The server still re-validates
// hard constraints (allergies, dietary restrictions, ingredient exclusions)
// on submit and rejects with 422 if invalid — the client filter is purely
// convenience, not a security boundary.
export const ReplaceSlotDialog = ({
  workspaceId,
  menuId,
  slot,
  open,
  onOpenChange,
}: ReplaceSlotDialogProps) => {
  const supabase = useSupabase()
  const recipesQuery = useRecipesList({
    supabase,
    workspaceId,
    enabled: open,
  })
  const replaceMutation = useReplaceMenuSlot({ workspaceId, menuId })
  const [search, setSearch] = useState('')

  const candidates = useMemo(() => {
    if (!slot) return []
    const term = search.trim().toLowerCase()
    return (recipesQuery.data ?? [])
      .filter((r) => r.recipe_kind === 'meal' && r.meal_types.includes(slot.meal_type as MealType))
      .filter((r) => r.id !== slot.recipe_id)
      .filter((r) => (term === '' ? true : r.name.toLowerCase().includes(term)))
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [recipesQuery.data, slot, search])

  const handlePick = async (candidate: RecipeRecord) => {
    if (!slot || !menuId) return
    try {
      await replaceMutation.mutateAsync({
        slotId: slot.id,
        recipeId: candidate.id,
      })
      notifySuccess(`Slot updated to ${candidate.name}.`)
      onOpenChange(false)
    } catch (err) {
      notifyError(err instanceof Error ? err.message : 'Slot replace failed.')
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] w-full max-w-lg overflow-hidden p-0">
        <DialogHeader className="border-b border-border px-6 py-4">
          <DialogTitle>Replace slot</DialogTitle>
          <DialogDescription>
            {slot ? (
              <>
                {capitalize(slot.day_of_week)} · {slot.meal_key}
                {slot.target_member_id ? ' (per-member)' : ''}
              </>
            ) : (
              'Pick a different recipe for this slot.'
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3 px-6 pb-6 pt-4">
          <Input
            type="search"
            placeholder="Search recipes…"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            autoFocus
          />

          <div className="-mx-2 max-h-[50vh] overflow-y-auto">
            {recipesQuery.isLoading ? (
              <div className="flex flex-col gap-2 px-2">
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
              </div>
            ) : candidates.length === 0 ? (
              <p className="px-2 text-sm text-muted-foreground">
                No other recipes match the meal type for this slot.
              </p>
            ) : (
              <ul className="flex flex-col gap-1 px-2">
                {candidates.map((candidate) => (
                  <li key={candidate.id}>
                    <button
                      type="button"
                      onClick={() => handlePick(candidate)}
                      disabled={replaceMutation.isPending}
                      className="flex w-full flex-col items-start gap-0.5 rounded-md border border-border bg-card/40 px-3 py-2 text-left text-sm transition-colors hover:border-primary/60 hover:bg-primary/5 disabled:opacity-50"
                    >
                      <span className="font-medium">{candidate.name}</span>
                      <span className="text-xs capitalize text-muted-foreground">
                        {candidate.difficulty} ·{' '}
                        {candidate.servings} serving
                        {candidate.servings === 1 ? '' : 's'}
                        {candidate.cuisine ? ` · ${candidate.cuisine}` : ''}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <DialogFooter className="border-t border-border px-6 py-3">
          {replaceMutation.isPending ? (
            <span className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              Replacing…
            </span>
          ) : null}
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
