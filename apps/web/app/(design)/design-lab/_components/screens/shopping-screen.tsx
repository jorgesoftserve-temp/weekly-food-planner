'use client'

import { useState } from 'react'
import { CheckCircle2, ChevronDown, ChevronUp, Minus, Plus, ShoppingCart } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { CozyShell } from '../cozy-shell'
import {
  type AcquiredStatus,
  type MockShoppingGroup,
  type MockShoppingItem,
  MOCK_SHOPPING_GROUPS,
  MOCK_SHOPPING_GROUPS_NEAR_COMPLETE,
} from '../mock-data'

// ── Completeness meter ────────────────────────────────────────────────────────
// Progress bar that changes color at the 30 and 90 thresholds.
// Completeness = sum(acquired_quantity) / sum(required_quantity) per §16.1.
// Numeric quantities are parsed from the string fields in mock data.

type CompletenessZone = 'low' | 'mid' | 'high'

type CompletenessConfig = {
  label: string
  description: string
  zone: CompletenessZone
  badgeClassName: string
}

const completenessConfig = (pct: number): CompletenessConfig => {
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

// Parse the numeric prefix from a qty string like "4 pcs", "190 g", "1.4 kg".
// Returns 0 if the string is "0" or starts with 0 without a unit.
const parseNumericQty = (qty: string): number => {
  const n = parseFloat(qty)
  return isNaN(n) ? 0 : n
}

// PRD §16.1: completeness = sum(acquired_quantity) / sum(required_quantity).
// Only items with status 'acquired' or 'partial' contribute acquired qty.
// Skipped items are excluded from both numerator and denominator (§16.1 status model).
const computePct = (groups: MockShoppingGroup[]): number => {
  let totalRequired = 0
  let totalAcquired = 0
  for (const group of groups) {
    for (const item of group.items) {
      if (item.status === 'skipped') continue
      totalRequired += parseNumericQty(item.requiredQty)
      totalAcquired += parseNumericQty(item.acquiredQty)
    }
  }
  return totalRequired === 0 ? 0 : Math.round((totalAcquired / totalRequired) * 100)
}

const CompletenessMeter = ({ pct, zoneLabel }: { pct: number; zoneLabel: string }) => {
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
        {/* Bar */}
        <div className="relative h-3 w-full overflow-hidden rounded-full bg-muted">
          <div
            className="completeness-bar h-full rounded-full motion-safe:transition-all motion-safe:duration-300"
            data-zone={cfg.zone}
            style={{ width: `${pct}%` }}
            role="progressbar"
            aria-valuenow={pct}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`${pct}% of items acquired — ${zoneLabel}`}
            aria-valuetext={`${pct}% acquired, ${zoneLabel}`}
          />
        </div>
        {/* Threshold markers at 30% and 90% */}
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

      {/* Threshold label row — explicit height so absolute labels don't clip */}
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
        {/* Finalize is always reachable per §16.1 — no disabled threshold */}
        <Button
          size="sm"
          variant={pct >= 90 ? 'default' : 'outline'}
        >
          Finalize shopping
        </Button>
      </div>
    </div>
  )
}

// ── Status badge ──────────────────────────────────────────────────────────────
const STATUS_CONFIG: Record<AcquiredStatus, { label: string; className: string }> = {
  pending:  { label: 'Pending',  className: 'border-border text-muted-foreground' },
  acquired: { label: 'Acquired', className: 'bg-success-tint text-success border-transparent' },
  partial:  { label: 'Partial',  className: 'bg-warning-tint text-warning border-transparent' },
  skipped:  { label: 'Skipped',  className: 'bg-muted text-muted-foreground border-transparent' },
}

const StatusBadge = ({ status }: { status: AcquiredStatus }) => {
  const cfg = STATUS_CONFIG[status]
  return (
    <Badge variant="outline" className={cn('text-xs', cfg.className)}>
      {cfg.label}
    </Badge>
  )
}

// ── Partial qty stepper ───────────────────────────────────────────────────────
// Extracts the unit suffix from a qty string like "6 pcs", "500 g", "1.4 kg".
// Returns the text after the first number+optional-decimal, trimmed.
const parseQtyUnit = (qty: string): string => {
  const match = qty.match(/^[\d.]+\s*(.*)$/)
  return match?.[1]?.trim() ?? ''
}

// ── Shopping item row ─────────────────────────────────────────────────────────
// Three discrete actions: [✓ check] toggles pending ↔ acquired;
// [Partial] activates partial status + reveals qty stepper;
// [Skip] sets skipped. Acquired qty is kept consistent on every transition so
// computePct() always reflects the real found amount.
const ShoppingItemRow = ({
  item,
  onStatusChange,
  onAcquiredQtyChange,
}: {
  item: MockShoppingItem
  onStatusChange: ({ id, status, acquiredQty }: { id: string; status: AcquiredStatus; acquiredQty: string }) => void
  onAcquiredQtyChange: ({ id, acquiredQty }: { id: string; acquiredQty: string }) => void
}) => {
  const requiredNumeric = parseNumericQty(item.requiredQty)
  const unit = parseQtyUnit(item.requiredQty)

  // Local stepper value — initialised from item's current acquired qty when
  // partial, otherwise 0. Stays local; persisted to parent on change.
  const [partialValue, setPartialValue] = useState<number>(() =>
    item.status === 'partial' ? parseNumericQty(item.acquiredQty) : 0,
  )

  const handleCheck = () => {
    if (item.status === 'acquired') {
      // Uncheck → pending, clear acquired qty
      onStatusChange({ id: item.id, status: 'pending', acquiredQty: `0 ${unit}`.trim() })
    } else {
      // Check → acquired, set acquired to full required amount
      onStatusChange({ id: item.id, status: 'acquired', acquiredQty: item.requiredQty })
    }
  }

  const handlePartial = () => {
    // Always activates partial with the current stepper value
    const safeValue = Math.min(partialValue, requiredNumeric)
    onStatusChange({
      id: item.id,
      status: 'partial',
      acquiredQty: unit ? `${safeValue} ${unit}` : String(safeValue),
    })
  }

  const handleSkip = () => {
    onStatusChange({ id: item.id, status: 'skipped', acquiredQty: `0 ${unit}`.trim() })
  }

  const handleStepperChange = (newValue: number) => {
    const clamped = Math.max(0, Math.min(newValue, requiredNumeric))
    setPartialValue(clamped)
    if (item.status === 'partial') {
      onAcquiredQtyChange({
        id: item.id,
        acquiredQty: unit ? `${clamped} ${unit}` : String(clamped),
      })
    }
  }

  const isPartial = item.status === 'partial'

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
        {/* Name + check circle */}
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <button
            type="button"
            onClick={handleCheck}
            aria-label={
              item.status === 'acquired'
                ? `Uncheck ${item.name} — mark as pending`
                : `Check ${item.name} — mark as fully acquired`
            }
            className="shrink-0 text-muted-foreground hover:text-success focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 rounded-full"
          >
            {item.status === 'acquired' ? (
              <CheckCircle2 className="size-5 text-success" aria-hidden />
            ) : (
              <div className="size-5 rounded-full border-2 border-border" aria-hidden />
            )}
          </button>
          <span
            className={cn(
              'min-w-0 truncate text-sm',
              (item.status === 'acquired' || item.status === 'skipped') &&
                'text-muted-foreground line-through',
            )}
          >
            {item.name}
          </span>
        </div>

        {/* Required qty */}
        <div className="text-xs text-muted-foreground tabular-nums">
          Need: {item.requiredQty}
        </div>

        {/* Current status badge */}
        <div className="shrink-0">
          <StatusBadge status={item.status} />
        </div>

        {/* Action buttons: Partial + Skip */}
        <div className="flex shrink-0 items-center gap-1.5">
          <button
            type="button"
            onClick={handlePartial}
            aria-pressed={isPartial}
            aria-label={`Mark ${item.name} as partially found`}
            className={cn(
              'rounded-full border px-2.5 py-0.5 text-xs font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1',
              isPartial
                ? 'border-warning/40 bg-warning-tint text-warning'
                : 'border-border text-muted-foreground hover:bg-muted',
            )}
          >
            Partial
          </button>
          <button
            type="button"
            onClick={handleSkip}
            aria-pressed={item.status === 'skipped'}
            aria-label={`Skip ${item.name}`}
            className={cn(
              'rounded-full border px-2.5 py-0.5 text-xs font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1',
              item.status === 'skipped'
                ? 'border-transparent bg-muted text-muted-foreground'
                : 'border-border text-muted-foreground hover:bg-muted',
            )}
          >
            Skip
          </button>
        </div>
      </div>

      {/* Inline partial qty selector — only visible when status is partial */}
      {isPartial && (
        <div className="flex items-center gap-2 rounded-lg border border-warning/30 bg-warning-tint/30 px-3 py-2">
          <span className="text-xs text-muted-foreground shrink-0">Found</span>
          <div className="flex items-center gap-1" role="group" aria-label={`Quantity of ${item.name} found`}>
            <button
              type="button"
              onClick={() => handleStepperChange(partialValue - 1)}
              aria-label={`Decrease found quantity of ${item.name}`}
              disabled={partialValue <= 0}
              className="flex size-6 items-center justify-center rounded-full border border-border bg-background text-muted-foreground hover:bg-muted disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Minus className="size-3" aria-hidden />
            </button>
            <input
              type="number"
              value={partialValue}
              min={0}
              max={requiredNumeric}
              onChange={(e) => handleStepperChange(Number(e.target.value))}
              aria-label={`Quantity of ${item.name} found`}
              className="w-14 rounded-md border border-border bg-background px-2 py-0.5 text-center text-xs tabular-nums focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
            />
            <button
              type="button"
              onClick={() => handleStepperChange(partialValue + 1)}
              aria-label={`Increase found quantity of ${item.name}`}
              disabled={partialValue >= requiredNumeric}
              className="flex size-6 items-center justify-center rounded-full border border-border bg-background text-muted-foreground hover:bg-muted disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Plus className="size-3" aria-hidden />
            </button>
          </div>
          {unit && (
            <span className="text-xs text-muted-foreground shrink-0">{unit}</span>
          )}
          <span className="ml-auto text-xs text-muted-foreground tabular-nums">
            of {item.requiredQty}
          </span>
        </div>
      )}
    </div>
  )
}

// ── Food group section ────────────────────────────────────────────────────────
const FoodGroupSection = ({
  group,
  onStatusChange,
  onAcquiredQtyChange,
}: {
  group: MockShoppingGroup
  onStatusChange: ({ id, status, acquiredQty }: { id: string; status: AcquiredStatus; acquiredQty: string }) => void
  onAcquiredQtyChange: ({ id, acquiredQty }: { id: string; acquiredQty: string }) => void
}) => {
  const [open, setOpen] = useState(true)
  const doneCount = group.items.filter(
    (i) => i.status === 'acquired' || i.status === 'skipped',
  ).length

  // Stable id for the collapsible content region (aria-controls target)
  const panelId = `shopping-group-${group.foodGroup.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')}`

  return (
    <div className="flex flex-col gap-0 rounded-2xl border border-border bg-card cozy-card overflow-hidden">
      {/* Section header */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center justify-between px-4 py-3 hover:bg-muted/50"
        aria-expanded={open}
        aria-controls={panelId}
      >
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold">{group.foodGroup}</span>
          <span className="text-xs text-muted-foreground">
            {doneCount}/{group.items.length}
          </span>
        </div>
        {open ? (
          <ChevronUp className="size-4 text-muted-foreground" aria-hidden />
        ) : (
          <ChevronDown className="size-4 text-muted-foreground" aria-hidden />
        )}
      </button>

      {open && (
        <div id={panelId} className="flex flex-col divide-y divide-border px-4 pb-3">
          {group.items.map((item) => (
            <div key={item.id} className="py-2.5">
              <ShoppingItemRow
                item={item}
                onStatusChange={onStatusChange}
                onAcquiredQtyChange={onAcquiredQtyChange}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Screen ────────────────────────────────────────────────────────────────────
type ShoppingState = 'in-progress' | 'near-complete'

export const ShoppingScreen = () => {
  const [view, setView] = useState<ShoppingState>('in-progress')
  const initialGroups =
    view === 'near-complete' ? MOCK_SHOPPING_GROUPS_NEAR_COMPLETE : MOCK_SHOPPING_GROUPS
  const [groups, setGroups] = useState<MockShoppingGroup[]>(initialGroups)

  const handleViewChange = (v: ShoppingState) => {
    setView(v)
    setGroups(v === 'near-complete' ? MOCK_SHOPPING_GROUPS_NEAR_COMPLETE : MOCK_SHOPPING_GROUPS)
  }

  // Status change also resets acquiredQty to the canonical value for that status:
  //   acquired  → full requiredQty  (caller passes item.requiredQty)
  //   pending   → "0 <unit>"        (caller passes zeroed string)
  //   skipped   → "0 <unit>"
  //   partial   → entered value     (caller passes stepper value string)
  const handleStatusChange = ({
    id,
    status,
    acquiredQty,
  }: {
    id: string
    status: AcquiredStatus
    acquiredQty: string
  }) => {
    setGroups((prev) =>
      prev.map((g) => ({
        ...g,
        items: g.items.map((item) =>
          item.id === id ? { ...item, status, acquiredQty } : item,
        ),
      })),
    )
  }

  // Stepper changes update only acquiredQty without changing status (item is already partial).
  const handleAcquiredQtyChange = ({ id, acquiredQty }: { id: string; acquiredQty: string }) => {
    setGroups((prev) =>
      prev.map((g) => ({
        ...g,
        items: g.items.map((item) =>
          item.id === id ? { ...item, acquiredQty } : item,
        ),
      })),
    )
  }

  const pct = computePct(groups)
  const zoneCfg = completenessConfig(pct)

  return (
    <CozyShell active="grocery" title="Shopping">
      <div className="flex flex-col gap-5">
        {/* Header + state switcher */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-col gap-0.5">
            <h2 className="text-base font-semibold">Shopping session</h2>
            <p className="text-sm text-muted-foreground">
              Week of Jun 9 · grouped by food group
            </p>
          </div>
          {/* Demo state toggler — not part of the live spec; only for design preview.
              Labels reflect the actual computed % so they stay in sync with the meter. */}
          <div className="flex items-center gap-1 rounded-full bg-muted p-1 text-xs">
            <button
              type="button"
              onClick={() => handleViewChange('in-progress')}
              className={cn(
                'rounded-full px-3 py-1 font-medium transition',
                view === 'in-progress'
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground',
              )}
            >
              In-progress ({view === 'in-progress' ? `${pct}%` : `${computePct(MOCK_SHOPPING_GROUPS)}%`})
            </button>
            <button
              type="button"
              onClick={() => handleViewChange('near-complete')}
              className={cn(
                'rounded-full px-3 py-1 font-medium transition',
                view === 'near-complete'
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground',
              )}
            >
              Near-complete ({view === 'near-complete' ? `${pct}%` : `${computePct(MOCK_SHOPPING_GROUPS_NEAR_COMPLETE)}%`})
            </button>
          </div>
        </div>

        {/* Completeness meter */}
        <CompletenessMeter pct={pct} zoneLabel={zoneCfg.label} />

        {/* Groups */}
        <div className="flex flex-col gap-3">
          {groups.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border bg-gradient-empty py-12 text-center">
              <div className="rounded-full bg-muted p-3 text-muted-foreground">
                <ShoppingCart className="size-5" aria-hidden />
              </div>
              <p className="text-sm font-medium">No grocery items for this menu</p>
              <p className="text-xs text-muted-foreground">
                Accept a menu to generate a grocery list.
              </p>
            </div>
          ) : (
            groups.map((group) => (
              <FoodGroupSection
                key={group.foodGroup}
                group={group}
                onStatusChange={handleStatusChange}
                onAcquiredQtyChange={handleAcquiredQtyChange}
              />
            ))
          )}
        </div>
      </div>
    </CozyShell>
  )
}
