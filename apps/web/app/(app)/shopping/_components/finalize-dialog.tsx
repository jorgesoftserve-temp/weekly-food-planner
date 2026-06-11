'use client'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import { completenessConfig } from './completeness-meter'

export const FinalizeDialog = ({
  open,
  pct,
  onConfirm,
  onCancel,
  isFinalizing,
}: {
  open: boolean
  pct: number
  onConfirm: () => void
  onCancel: () => void
  isFinalizing: boolean
}) => {
  const cfg = completenessConfig(pct)

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onCancel() }}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Finalize shopping?</DialogTitle>
          <DialogDescription>
            This will close the session and move all acquired items to your
            inventory. You cannot undo this.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3 py-2">
          <div className="flex items-center justify-between gap-2 rounded-lg border border-border bg-muted/40 px-4 py-3">
            <span className="text-sm text-muted-foreground">Completeness</span>
            <div className="flex items-center gap-2">
              <span className="text-lg font-bold tabular-nums">{pct}%</span>
              <Badge variant="outline" className={cn('text-xs', cfg.badgeClassName)}>
                {cfg.label}
              </Badge>
            </div>
          </div>

          {pct < 30 && (
            <p className="text-xs text-destructive">
              Most items are still missing. Consider finishing your shopping before finalizing.
            </p>
          )}
          {pct >= 30 && pct < 90 && (
            <p className="text-xs text-muted-foreground">
              Some items are missing but you can finalize anyway. Missing items will not appear in inventory.
            </p>
          )}
          {pct >= 90 && (
            <p className="text-xs text-muted-foreground">
              Great — all items are accounted for.
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onCancel} disabled={isFinalizing}>
            Keep shopping
          </Button>
          <Button onClick={onConfirm} disabled={isFinalizing}>
            {isFinalizing ? 'Finalizing…' : 'Finalize'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
