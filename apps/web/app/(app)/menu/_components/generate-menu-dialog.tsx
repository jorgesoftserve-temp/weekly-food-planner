'use client'

import { useState } from 'react'
import { AlertCircle, Loader2 } from 'lucide-react'
import {
  useGenerateMenu,
  type GenerateMenuResponse,
} from '@/lib/hooks/use-generate-menu'
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
import { notifyError, notifySuccess } from '@/lib/toast'

const formatYmd = (date: Date): string => {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

// Returns the next Monday on or after `from`. Used as the default week-start
// because day_of_week in the engine starts Monday (DATABASE_PRD).
const nextMonday = (from: Date): string => {
  const date = new Date(from)
  const day = date.getDay() // Sun=0, Mon=1, ..., Sat=6
  const offset = day === 0 ? 1 : day === 1 ? 0 : 8 - day
  date.setDate(date.getDate() + offset)
  return formatYmd(date)
}

const reasonLabel = (reasonCode: string): string => {
  switch (reasonCode) {
    case 'no_valid_recipe':
      return 'No recipe satisfies one of the slots'
    case 'no_slots':
      return 'This workspace has no meal frequency'
    case 'empty_workspace':
      return 'No recipes yet'
    default:
      return 'Generation failed'
  }
}

export type GenerateMenuDialogProps = {
  workspaceId: string
  open: boolean
  onOpenChange: (open: boolean) => void
  mode: 'create' | 'regenerate'
}

export const GenerateMenuDialog = ({
  workspaceId,
  open,
  onOpenChange,
  mode,
}: GenerateMenuDialogProps) => {
  const [weekStartDate, setWeekStartDate] = useState<string>(() =>
    nextMonday(new Date()),
  )
  const [failure, setFailure] = useState<GenerateMenuResponse | null>(null)
  const mutation = useGenerateMenu({ workspaceId })

  const reset = () => {
    setFailure(null)
    setWeekStartDate(nextMonday(new Date()))
  }

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setFailure(null)
    try {
      const result = await mutation.mutateAsync({ weekStartDate })
      if (result.ok) {
        notifySuccess(
          mode === 'create' ? 'Menu generated' : 'Menu regenerated',
          `Week of ${weekStartDate}`,
        )
        reset()
        onOpenChange(false)
        return
      }
      setFailure(result)
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : 'Could not reach the menu generator.'
      notifyError('Generation failed', message)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) reset()
        onOpenChange(next)
      }}
    >
      <DialogContent>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>
              {mode === 'create' ? 'Generate a weekly menu' : 'Regenerate menu'}
            </DialogTitle>
            <DialogDescription>
              {mode === 'create'
                ? 'Pick the week start (Monday) and the constraint engine will assign a recipe to every member-meal slot.'
                : 'A new menu replaces the active one. The previous menu is soft-deleted in a single transaction.'}
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-2">
            <Label htmlFor="week_start_date">Week starting</Label>
            <Input
              id="week_start_date"
              type="date"
              required
              value={weekStartDate}
              onChange={(event) => setWeekStartDate(event.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Tip: the engine treats day_of_week as Monday-first, so a Monday
              date keeps the export layout clean.
            </p>
          </div>

          {failure && !failure.ok ? (
            <div className="flex gap-3 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm">
              <AlertCircle className="mt-0.5 size-4 shrink-0 text-destructive" />
              <div className="flex flex-col gap-1">
                <p className="font-medium text-destructive">
                  {reasonLabel(failure.error.reasonCode)}
                </p>
                {failure.error.message ? (
                  <p className="text-muted-foreground">
                    {failure.error.message}
                  </p>
                ) : null}
                {failure.error.affectedMeal || failure.error.affectedMemberId ? (
                  <p className="text-muted-foreground">
                    Slot{' '}
                    {failure.error.affectedMeal ? (
                      <code className="rounded bg-muted px-1 py-0.5">
                        {failure.error.affectedMeal}
                      </code>
                    ) : null}
                    {failure.error.affectedMemberId
                      ? ` for member ${failure.error.affectedMemberId}`
                      : ''}
                  </p>
                ) : null}
              </div>
            </div>
          ) : null}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={mutation.isPending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Generating…
                </>
              ) : mode === 'create' ? (
                'Generate menu'
              ) : (
                'Replace active menu'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
