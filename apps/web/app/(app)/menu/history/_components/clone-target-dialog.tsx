'use client'

import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
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

const formatYmd = (date: Date): string => {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

const today = (): string => formatYmd(new Date())

export type CloneTargetDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  // Source menu being cloned. Used only for the dialog copy; the actual
  // clone is performed by the host via onConfirm so the host owns the
  // mutation lifecycle / toast wiring.
  sourceWeekStartDate: string | null
  sourceMenuType: 'weekly' | 'custom' | null
  sourceDurationDays: number | null
  isPending: boolean
  onConfirm: (input: { weekStartDate: string }) => void
}

// Lets the user pick a target start date when cloning a historical menu.
// Mirrors the date controls in GenerateMenuDialog (start date + implicit
// duration carried over from the source); a separate component because
// the history page is otherwise a thin shell.
export const CloneTargetDialog = ({
  open,
  onOpenChange,
  sourceWeekStartDate,
  sourceMenuType,
  sourceDurationDays,
  isPending,
  onConfirm,
}: CloneTargetDialogProps) => {
  const [weekStartDate, setWeekStartDate] = useState<string>(() => today())

  // Reset to today every time the dialog re-opens so the previous source's
  // date doesn't leak in if the user clones a second menu.
  useEffect(() => {
    if (open) setWeekStartDate(today())
  }, [open])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Clone as a new draft</DialogTitle>
          <DialogDescription>
            {sourceWeekStartDate && sourceMenuType && sourceDurationDays
              ? `Copies the ${sourceMenuType} menu from week of ${sourceWeekStartDate} (${sourceDurationDays} day${sourceDurationDays === 1 ? '' : 's'}) into a new draft starting on the date you pick.`
              : 'Copies a historical menu into a new draft. Pick the start date.'}
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-2">
          <Label htmlFor="clone_target_date">Start date for the clone</Label>
          <Input
            id="clone_target_date"
            type="date"
            required
            value={weekStartDate}
            onChange={(event) => setWeekStartDate(event.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            Duration is preserved from the original menu — change it later
            from the draft review screen if needed.
          </p>
        </div>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isPending}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={() => onConfirm({ weekStartDate })}
            disabled={isPending}
          >
            {isPending ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Cloning…
              </>
            ) : (
              'Clone draft'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
