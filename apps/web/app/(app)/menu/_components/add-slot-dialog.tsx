'use client'

import { useEffect, useMemo, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { useRecipesList } from '@weekly-food-planner/supabase/react'
import type {
  MenuRecord,
  RecipeRecord,
} from '@weekly-food-planner/supabase'
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
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { useAddMenuSlot } from '@/lib/hooks/use-menu-draft'
import { useSupabase } from '@/lib/hooks/use-supabase'
import { notifyError, notifySuccess } from '@/lib/toast'

const MEAL_TYPES = ['breakfast', 'lunch', 'dinner', 'snack'] as const
type MealType = (typeof MEAL_TYPES)[number]

const capitalize = (s: string): string =>
  s.length === 0 ? s : s.charAt(0).toUpperCase() + s.slice(1)

export type AddSlotDialogProps = {
  workspaceId: string
  menu: MenuRecord | null
  // The day the user clicked "Add meal" on. The user can still change the
  // mealType inside the dialog, but the day is fixed once opened.
  dayOfWeek: string | null
  // Resolved name map sourced from the workspace's members. We render the
  // member dropdown from this — participants of the menu only.
  memberNamesById: Record<string, string>
  open: boolean
  onOpenChange: (open: boolean) => void
}

// Adds a new slot to the current draft. Server picks the meal_key (based on
// existing slots in the same (day, target_member_id) bucket) and runs the
// engine's hard-constraint validator for weekly menus.
export const AddSlotDialog = ({
  workspaceId,
  menu,
  dayOfWeek,
  memberNamesById,
  open,
  onOpenChange,
}: AddSlotDialogProps) => {
  const supabase = useSupabase()
  const recipesQuery = useRecipesList({
    supabase,
    workspaceId,
    enabled: open,
  })
  const addMutation = useAddMenuSlot({
    workspaceId,
    menuId: menu?.id ?? null,
  })

  const participantIds = useMemo(
    () => menu?.menu_participants?.map((p) => p.member_id) ?? [],
    [menu],
  )
  const participantOptions = useMemo(
    () =>
      participantIds.map((id) => ({
        id,
        name: memberNamesById[id] ?? id.slice(0, 6),
      })),
    [participantIds, memberNamesById],
  )

  const [mealType, setMealType] = useState<MealType>('lunch')
  // 'shared' = NULL target_member_id; otherwise a participant id.
  const [target, setTarget] = useState<string>('shared')
  const [search, setSearch] = useState('')

  useEffect(() => {
    if (open) {
      setMealType('lunch')
      setTarget('shared')
      setSearch('')
    }
  }, [open])

  const candidates = useMemo<RecipeRecord[]>(() => {
    const term = search.trim().toLowerCase()
    return (recipesQuery.data ?? [])
      .filter((r) => r.recipe_kind === 'meal' && r.meal_types.includes(mealType))
      .filter((r) => (term === '' ? true : r.name.toLowerCase().includes(term)))
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [recipesQuery.data, mealType, search])

  const handlePick = async (candidate: RecipeRecord) => {
    if (!menu || !dayOfWeek) return
    try {
      await addMutation.mutateAsync({
        dayOfWeek,
        mealType,
        recipeId: candidate.id,
        targetMemberId: target === 'shared' ? null : target,
      })
      notifySuccess(
        `Added ${candidate.name} to ${capitalize(dayOfWeek)}.`,
      )
      onOpenChange(false)
    } catch (err) {
      notifyError(err instanceof Error ? err.message : 'Add slot failed.')
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] w-full max-w-lg overflow-hidden p-0">
        <DialogHeader className="border-b border-border px-6 py-4">
          <DialogTitle>
            Add a meal{dayOfWeek ? ` on ${capitalize(dayOfWeek)}` : ''}
          </DialogTitle>
          <DialogDescription>
            Pick a meal type, who it&apos;s for, and the recipe. Weekly draft
            slots are validated against hard constraints server-side.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3 px-6 pb-4 pt-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs">Meal type</Label>
              <Select
                value={mealType}
                onValueChange={(next) => setMealType(next as MealType)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MEAL_TYPES.map((mt) => (
                    <SelectItem key={mt} value={mt}>
                      {mt}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs">For</Label>
              <Select value={target} onValueChange={setTarget}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="shared">Shared</SelectItem>
                  {participantOptions.map((opt) => (
                    <SelectItem key={opt.id} value={opt.id}>
                      {opt.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <Input
            type="search"
            placeholder={`Search ${mealType} recipes…`}
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            autoFocus
          />

          <div className="-mx-2 max-h-[40vh] overflow-y-auto">
            {recipesQuery.isLoading ? (
              <div className="flex flex-col gap-2 px-2">
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
              </div>
            ) : candidates.length === 0 ? (
              <p className="px-2 text-sm text-muted-foreground">
                No {mealType} recipes match.
              </p>
            ) : (
              <ul className="flex flex-col gap-1 px-2">
                {candidates.map((candidate) => (
                  <li key={candidate.id}>
                    <button
                      type="button"
                      onClick={() => handlePick(candidate)}
                      disabled={addMutation.isPending}
                      className="flex w-full flex-col items-start gap-0.5 rounded-md border border-border bg-card/40 px-3 py-2 text-left text-sm transition-colors hover:border-primary/60 hover:bg-primary/5 disabled:opacity-50"
                    >
                      <span className="font-medium">{candidate.name}</span>
                      <span className="text-xs capitalize text-muted-foreground">
                        {candidate.difficulty} · {candidate.servings} serving
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
          {addMutation.isPending ? (
            <span className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              Adding…
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
