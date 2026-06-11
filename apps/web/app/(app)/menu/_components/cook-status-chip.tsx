'use client'

import { CheckCircle2, ChevronRight, MinusCircle } from 'lucide-react'
import type { DbTypes } from '@weekly-food-planner/supabase'
import { cn } from '@/lib/utils'

type SlotCookStatus = DbTypes.SlotCookStatus

const CONFIG: Record<
  SlotCookStatus,
  { label: string; icon: typeof CheckCircle2; activeClass: string }
> = {
  planned: {
    label: 'Planned',
    icon: ChevronRight,
    activeClass: 'bg-muted text-foreground border-border',
  },
  cooked: {
    label: 'Cooked',
    icon: CheckCircle2,
    activeClass: 'bg-success-tint text-success border-transparent',
  },
  skipped: {
    label: 'Skipped',
    icon: MinusCircle,
    activeClass: 'bg-muted text-muted-foreground border-transparent',
  },
}

const CYCLE: SlotCookStatus[] = ['planned', 'cooked', 'skipped']

// (v2.0 Phase 4) Compact cycling cook-status chip: planned → cooked → skipped.
// Icon-led with a visible label; one tap advances the status. Backed by
// slot_completions via the parent's onChange. Matches the approved menu-exec mock.
export const CookStatusChip = ({
  status,
  recipeName,
  onChange,
  disabled = false,
}: {
  status: SlotCookStatus
  recipeName: string
  onChange: ({ status }: { status: SlotCookStatus }) => void
  disabled?: boolean
}) => {
  const next = CYCLE[(CYCLE.indexOf(status) + 1) % CYCLE.length]!
  const cfg = CONFIG[status]
  const Icon = cfg.icon
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => onChange({ status: next })}
      aria-label={`${recipeName} cook status: ${status}. Tap to mark ${next}.`}
      className={cn(
        'inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1',
        'disabled:opacity-60',
        cfg.activeClass,
      )}
    >
      <Icon className="size-3.5 shrink-0" aria-hidden />
      <span>{cfg.label}</span>
    </button>
  )
}
