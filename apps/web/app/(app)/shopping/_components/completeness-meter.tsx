'use client'

import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

// ── Zone configuration ────────────────────────────────────────────────────────
// Mirrors the design-lab mock's completenessConfig exactly.
// The .completeness-bar[data-zone] CSS token is defined in globals.css §186.

export type CompletenessZone = 'low' | 'mid' | 'high'

export type CompletenessConfig = {
  label: string
  description: string
  zone: CompletenessZone
  badgeClassName: string
}

export const completenessConfig = (pct: number): CompletenessConfig => {
  if (pct >= 90) {
    return {
      label: 'Complete',
      description: 'You have everything you need. Ready to finalize.',
      zone: 'high',
      badgeClassName: 'bg-success-tint text-success border-transparent',
    }
  }
  if (pct >= 30) {
    return {
      label: 'Incomplete',
      description: 'Some items are still missing. You can finalize or keep shopping.',
      zone: 'mid',
      badgeClassName: 'bg-warning-tint text-warning border-transparent',
    }
  }
  return {
    label: 'Barely shopped',
    description: 'Most items are still missing. Consider finishing your shopping first.',
    zone: 'low',
    badgeClassName: 'border-destructive/40 bg-destructive/10 text-destructive',
  }
}

// ── CompletenessMeter ─────────────────────────────────────────────────────────

export const CompletenessMeter = ({
  pct,
  onFinalize,
  isFinalizing,
  readOnly = false,
}: {
  pct: number
  onFinalize?: () => void
  isFinalizing?: boolean
  readOnly?: boolean
}) => {
  const cfg = completenessConfig(pct)

  return (
    <div className="flex flex-col gap-2 rounded-2xl border border-border bg-card p-4 cozy-card">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium">Shopping completeness</span>
        <Badge variant="outline" className={cn('text-xs', cfg.badgeClassName)}>
          {cfg.label}
        </Badge>
      </div>

      {/* Progress bar with threshold markers */}
      <div className="relative">
        <div className="relative h-3 w-full overflow-hidden rounded-full bg-muted">
          <div
            className="completeness-bar h-full rounded-full motion-safe:transition-all motion-safe:duration-300"
            data-zone={cfg.zone}
            style={{ width: `${pct}%` }}
            role="progressbar"
            aria-valuenow={pct}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`${pct}% of items acquired — ${cfg.label}`}
            aria-valuetext={`${pct}% acquired, ${cfg.label}`}
          />
        </div>
        <div
          className="absolute top-0 h-3 w-px bg-border"
          style={{ left: '30%' }}
          aria-hidden
        />
        <div
          className="absolute top-0 h-3 w-px bg-border"
          style={{ left: '90%' }}
          aria-hidden
        />
      </div>

      {/* Threshold label row */}
      <div className="relative h-4 flex text-xs text-muted-foreground" aria-hidden>
        <span className="absolute" style={{ left: '30%', transform: 'translateX(-50%)' }}>
          30%
        </span>
        <span className="absolute" style={{ left: '90%', transform: 'translateX(-50%)' }}>
          90%
        </span>
      </div>

      <p className="mt-1 text-xs text-muted-foreground">{cfg.description}</p>

      <div className="flex items-center justify-between gap-2 pt-1">
        <span className="text-2xl font-bold tabular-nums">{pct}%</span>
        {!readOnly && onFinalize ? (
          <Button
            size="sm"
            variant={pct >= 90 ? 'default' : 'outline'}
            onClick={onFinalize}
            disabled={isFinalizing}
          >
            {isFinalizing ? 'Finalizing…' : 'Finalize shopping'}
          </Button>
        ) : null}
      </div>
    </div>
  )
}
