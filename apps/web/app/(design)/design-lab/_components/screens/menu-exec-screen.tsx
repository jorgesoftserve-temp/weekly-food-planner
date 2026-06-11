'use client'

import { useEffect, useId, useState } from 'react'
import {
  AlertTriangle,
  ArrowLeftRight,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  List,
  Minus,
  MinusCircle,
  Plus,
  Refrigerator,
  Users,
  X,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import { CozyShell } from '../cozy-shell'
import {
  type CookStatus,
  type MealKey,
  type MockInventoryItem,
  type MockRecipe,
  type MockRecipeIngredient,
  type MockSlotEntry,
  MEALS,
  MOCK_INGREDIENT_OVERRIDE,
  MOCK_MEMBERS,
  MOCK_SLOT_STATUSES,
  MOCK_SUGGESTED_SUBSTITUTES,
  MOCK_WEEK,
  memberAccentStyle,
  memberDotStyle,
} from '../mock-data'

// ── Cook-time reconciliation sheet ───────────────────────────────────────────
// Opened when a slot is marked Cooked. The user can record how much of each
// ingredient they actually used; any shortfall is offered as a Pantry leftover
// (cook_remainder). Skippable via "Skip" — no pantry items are created.
// Also accessible via a "Reconcile / leftovers" affordance on already-cooked slots.

type ReconcileRow = {
  ingredient: MockRecipeIngredient
  usedQty: number
  addToPantry: boolean
}

type ReconcileSheetProps = {
  open: boolean
  recipe: MockRecipe | null
  onClose: () => void
  onSave: ({ leftovers }: { leftovers: MockInventoryItem[] }) => void
}

const ReconcileSheet = ({ open, recipe, onClose, onSave }: ReconcileSheetProps) => {
  const [rows, setRows] = useState<ReconcileRow[]>([])

  // Initialise / reset rows whenever the target recipe changes. The sheet is
  // mounted persistently and `open` toggles, so Radix sequences the dialog
  // title before the content mounts — an already-open mount races that check
  // and triggers the "DialogContent requires a DialogTitle" warning.
  useEffect(() => {
    setRows(
      (recipe?.ingredients ?? []).map((ing) => ({
        ingredient: ing,
        usedQty: ing.plannedQty,
        addToPantry: true,
      })),
    )
  }, [recipe])

  const setUsed = ({ id, delta }: { id: string; delta: number }) => {
    setRows((prev) =>
      prev.map((r) => {
        if (r.ingredient.id !== id) return r
        const next = Math.max(0, Math.min(r.ingredient.plannedQty, r.usedQty + delta))
        return { ...r, usedQty: next, addToPantry: next < r.ingredient.plannedQty }
      }),
    )
  }

  const togglePantry = ({ id }: { id: string }) => {
    setRows((prev) =>
      prev.map((r) =>
        r.ingredient.id === id ? { ...r, addToPantry: !r.addToPantry } : r,
      ),
    )
  }

  const handleSave = () => {
    if (!recipe) return
    const leftovers: MockInventoryItem[] = rows
      .filter((r) => r.usedQty < r.ingredient.plannedQty && r.addToPantry)
      .map((r) => ({
        id: `inv-rem-${r.ingredient.id}-${Date.now()}`,
        ingredient: r.ingredient.name,
        quantity: r.ingredient.plannedQty - r.usedQty,
        unit: r.ingredient.unit,
        source: 'cook_remainder' as const,
        expirationDate: '2026-06-13',
        nearExpiry: true,
        isConsumed: false,
        sourceMealName: recipe.name,
        provenanceNote: `From: ${recipe.name} — unused`,
      }))
    onSave({ leftovers })
  }

  const handleSkip = () => {
    onClose()
  }

  const hasRemainder = rows.some((r) => r.usedQty < r.ingredient.plannedQty)

  return (
    <Sheet open={open} onOpenChange={(v) => { if (!v) handleSkip() }}>
      <SheetContent
        side="right"
        className="flex w-full flex-col gap-0 sm:max-w-md"
      >
        <SheetHeader className="pb-4">
          {/* No manual id/aria — Radix auto-wires aria-labelledby/-describedby
              from SheetTitle/SheetDescription. Overriding the title's id breaks
              Radix's getElementById title-presence check and warns. */}
          <SheetTitle>Used what you planned?</SheetTitle>
          <SheetDescription>
            Record how much of each ingredient you actually used for{' '}
            <strong>{recipe?.name ?? 'this recipe'}</strong>. Any remainder can be saved to your pantry.
          </SheetDescription>
        </SheetHeader>

        {/* Ingredient reconciliation rows */}
        <div className="flex flex-1 flex-col gap-1 overflow-y-auto py-2" role="list" aria-label="Ingredient usage">
          {(recipe?.ingredients ?? []).length === 0 && (
            <p className="text-sm text-muted-foreground py-4 text-center">
              No ingredients recorded for this recipe.
            </p>
          )}
          {rows.map((row) => {
            const remainder = row.ingredient.plannedQty - row.usedQty
            const checkboxId = `pantry-${row.ingredient.id}`
            return (
              <div
                key={row.ingredient.id}
                role="listitem"
                className={cn(
                  'flex flex-col gap-2 rounded-xl border border-border bg-card p-3 transition',
                  remainder > 0 && row.addToPantry && 'border-success/30 bg-success-tint/10',
                )}
              >
                {/* Top row: name + planned + used stepper */}
                <div className="flex items-center gap-3">
                  <span className="flex-1 text-sm font-medium">{row.ingredient.name}</span>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    planned{' '}
                    <span className="font-semibold tabular-nums text-foreground">
                      {row.ingredient.plannedQty}
                    </span>
                  </span>
                  {/* Used stepper */}
                  <div
                    className="flex items-center gap-1"
                    role="group"
                    aria-label={`Used quantity of ${row.ingredient.name}`}
                  >
                    <button
                      type="button"
                      aria-label={`Decrease used quantity of ${row.ingredient.name}`}
                      onClick={() => setUsed({ id: row.ingredient.id, delta: -1 })}
                      disabled={row.usedQty === 0}
                      className={cn(
                        'flex size-6 items-center justify-center rounded-full border border-border bg-background text-muted-foreground',
                        'hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed',
                        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1',
                      )}
                    >
                      <Minus className="size-3" aria-hidden />
                    </button>
                    <span
                      className="w-8 text-center text-sm font-semibold tabular-nums"
                      aria-live="polite"
                      aria-label={`Used: ${row.usedQty} ${row.ingredient.unit}`}
                    >
                      {row.usedQty}
                    </span>
                    <button
                      type="button"
                      aria-label={`Increase used quantity of ${row.ingredient.name}`}
                      onClick={() => setUsed({ id: row.ingredient.id, delta: +1 })}
                      disabled={row.usedQty === row.ingredient.plannedQty}
                      className={cn(
                        'flex size-6 items-center justify-center rounded-full border border-border bg-background text-muted-foreground',
                        'hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed',
                        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1',
                      )}
                    >
                      <Plus className="size-3" aria-hidden />
                    </button>
                  </div>
                </div>

                {/* Remainder row: shown when used < planned */}
                {remainder > 0 && (
                  <div className="flex items-center gap-2 pl-1">
                    <Refrigerator className="size-3.5 shrink-0 text-success" aria-hidden />
                    <span className="flex-1 text-xs text-muted-foreground">
                      {remainder} {row.ingredient.unit} left — add to pantry
                    </span>
                    <Checkbox
                      id={checkboxId}
                      checked={row.addToPantry}
                      onCheckedChange={() => togglePantry({ id: row.ingredient.id })}
                      aria-label={`Add ${remainder} ${row.ingredient.unit} of ${row.ingredient.name} to pantry`}
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
          })}
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
          >
            Skip
          </Button>
          <Button
            className="flex-1"
            onClick={handleSave}
          >
            Save leftovers
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}

// ── Cook-status control ───────────────────────────────────────────────────────
const COOK_STATUS_CONFIG: Record<
  CookStatus,
  { label: string; icon: typeof CheckCircle2; activeClass: string; ariaLabel: string }
> = {
  planned: {
    label: 'Planned',
    icon: ChevronRight,
    activeClass: 'bg-muted text-foreground border-border',
    ariaLabel: 'Mark as planned',
  },
  cooked: {
    label: 'Cooked',
    icon: CheckCircle2,
    activeClass: 'bg-success-tint text-success border-transparent',
    ariaLabel: 'Mark as cooked',
  },
  skipped: {
    label: 'Skipped',
    icon: MinusCircle,
    activeClass: 'bg-muted text-muted-foreground border-transparent',
    ariaLabel: 'Mark as skipped',
  },
}

// Compact cycling status chip — single button that cycles planned → cooked → skipped.
// Icon-led with visible label. Used in both the desktop calendar grid and the
// mobile/list accordion, replacing the now-removed CookStatusControl segmented group.
const CookStatusChip = ({
  status,
  onChange,
  recipeName,
}: {
  status: CookStatus
  onChange: ({ status }: { status: CookStatus }) => void
  recipeName: string
}) => {
  const cycle: CookStatus[] = ['planned', 'cooked', 'skipped']
  const next = cycle[(cycle.indexOf(status) + 1) % cycle.length]!
  const cfg = COOK_STATUS_CONFIG[status]
  const Icon = cfg.icon
  return (
    <button
      type="button"
      onClick={() => onChange({ status: next })}
      aria-label={`${recipeName} cook status: ${status}. Tap to change.`}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition',
        cfg.activeClass,
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1',
      )}
    >
      <Icon className="size-3.5 shrink-0" aria-hidden />
      <span>{cfg.label}</span>
    </button>
  )
}

// ── Member picker ─────────────────────────────────────────────────────────────
type MemberFilter = 'all' | string

const MenuMemberPicker = ({
  selected,
  onSelect,
}: {
  selected: MemberFilter
  onSelect: ({ memberId }: { memberId: MemberFilter }) => void
}) => (
  <div className="flex flex-wrap items-center gap-2" role="group" aria-label="View menu for">
    <span className="text-xs text-muted-foreground">View for:</span>
    <button
      type="button"
      onClick={() => onSelect({ memberId: 'all' })}
      aria-pressed={selected === 'all'}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-medium transition',
        selected === 'all'
          ? 'bg-accent-tint text-accent-strong'
          : 'border border-border text-muted-foreground hover:bg-muted',
      )}
    >
      <Users className="size-3.5" aria-hidden />
      Everyone
    </button>
    {MOCK_MEMBERS.map((m) => (
      <button
        key={m.id}
        type="button"
        onClick={() => onSelect({ memberId: m.id })}
        aria-pressed={selected === m.id}
        className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm font-medium transition"
        style={selected === m.id ? memberAccentStyle(m.accent) : undefined}
      >
        <span
          className="size-2 rounded-full"
          aria-hidden
          style={memberDotStyle(m.accent)}
        />
        {m.name.split(' ')[0]}
      </button>
    ))}
  </div>
)

// ── Substitution panel ────────────────────────────────────────────────────────
const SubstitutionControl = ({
  day,
  meal,
  onClose,
  panelId,
}: {
  day: string
  meal: MealKey
  onClose: () => void
  panelId: string
}) => {
  const [selected, setSelected] = useState<string | null>(MOCK_INGREDIENT_OVERRIDE.substituteIngredient)
  const [substituteQty, setSubstituteQty] = useState(MOCK_INGREDIENT_OVERRIDE.substituteQty)
  const override = MOCK_INGREDIENT_OVERRIDE

  return (
    <div id={panelId} className="mt-2 flex flex-col gap-3 rounded-xl border border-border bg-muted/50 p-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
          <ArrowLeftRight className="size-3.5" aria-hidden />
          Ingredient substitution for {day} {meal}
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close substitution panel"
          className="text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <X className="size-4" aria-hidden />
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="rounded-full bg-destructive/10 px-2 py-0.5 text-xs font-medium text-destructive line-through">
          {override.originalIngredient} ({override.originalQty})
        </span>
        <ArrowLeftRight className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
        <span className="rounded-full bg-success-tint px-2 py-0.5 text-xs font-medium text-success">
          {selected ?? '—'}
        </span>
      </div>

      <div className="flex flex-col gap-1.5">
        <span className="text-xs font-medium text-muted-foreground">Suggested substitutes</span>
        {MOCK_SUGGESTED_SUBSTITUTES.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => setSelected(s.name)}
            aria-pressed={selected === s.name}
            className={cn(
              'flex items-start gap-2 rounded-lg border px-3 py-2 text-left text-sm transition',
              selected === s.name
                ? 'border-success/40 bg-success-tint/30 text-foreground'
                : 'border-border bg-background text-muted-foreground hover:bg-muted',
            )}
          >
            <span className="flex-1">
              <span className="block font-medium text-foreground">{s.name}</span>
              <span className="text-xs text-muted-foreground">{s.note}</span>
            </span>
            {selected === s.name && (
              <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" aria-hidden />
            )}
          </button>
        ))}
      </div>

      {selected && (
        <div className="flex items-center gap-2">
          <label htmlFor="sub-qty" className="shrink-0 text-xs text-muted-foreground">
            Quantity for {selected}:
          </label>
          <input
            id="sub-qty"
            type="text"
            value={substituteQty}
            onChange={(e) => setSubstituteQty(e.target.value)}
            className="w-24 rounded-md border border-border bg-background px-2 py-1 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label={`Substitute quantity for ${selected}`}
          />
        </div>
      )}

      <div className="flex justify-end gap-2">
        <Button size="sm" variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button size="sm">Apply substitution</Button>
      </div>
    </div>
  )
}

// ── Desktop slot card ─────────────────────────────────────────────────────────
// CHANGE #2: now receives `entries` (array) instead of a single recipe.
// Stacks mini-cards; if > 2 entries shows "+N more" expand.

type SlotStatusMap = Map<string, CookStatus>
const slotKey = (day: string, meal: MealKey) => `${day}::${meal}`

const DesktopSlotCard = ({
  day,
  meal,
  entries,
  statuses,
  alertSlots,
  memberFilter,
  onStatusChange,
  onOpenReconcile,
}: {
  day: string
  meal: MealKey
  entries: MockSlotEntry[]
  statuses: SlotStatusMap
  alertSlots: Set<string>
  memberFilter: MemberFilter
  onStatusChange: ({ day, meal, status, recipe }: { day: string; meal: MealKey; status: CookStatus; recipe?: MockRecipe }) => void
  onOpenReconcile: ({ recipe, key }: { recipe: MockRecipe; key: string }) => void
}) => {
  const [showSub, setShowSub] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const subPanelId = useId()
  const key = slotKey(day, meal)
  const isOverride = MOCK_INGREDIENT_OVERRIDE.day === day && MOCK_INGREDIENT_OVERRIDE.meal === meal
  const hasAlert = alertSlots.has(key)

  // Filter entries by member
  const visibleEntries = entries.filter((e) => {
    if (memberFilter === 'all') return true
    if (!e.targetMemberId) return true
    return e.targetMemberId === memberFilter
  })

  if (visibleEntries.length === 0) {
    return (
      <div
        className="flex h-full min-h-[5rem] items-center justify-center rounded-xl border border-dashed border-border bg-muted/30 text-xs text-muted-foreground"
        aria-label={`${day} ${meal}: no meal planned`}
      >
        No meal
      </div>
    )
  }

  // Show at most 2 initially; "+N more" expands the rest
  const COLLAPSE_AT = 2
  const shown = expanded ? visibleEntries : visibleEntries.slice(0, COLLAPSE_AT)
  const hiddenCount = visibleEntries.length - COLLAPSE_AT

  return (
    <div
      className={cn(
        'flex min-w-0 flex-col gap-2 overflow-hidden rounded-xl border border-border bg-card p-2',
        // Overall cooked state derives from first visible entry for border tint
        statuses.get(key) === 'cooked' && 'border-success/30 bg-success-tint/10',
        statuses.get(key) === 'skipped' && 'opacity-60',
      )}
    >
      {shown.map((entry, idx) => {
        const entryKey = `${key}-${idx}`
        const cookStatus = statuses.get(entryKey) ?? statuses.get(key) ?? 'planned'
        const member = MOCK_MEMBERS.find((m) => m.id === entry.targetMemberId)
        return (
          <div key={entryKey} className="flex flex-col gap-1.5 rounded-lg bg-muted/40 p-1.5">
            {/* Recipe name */}
            <span
              className={cn(
                'text-[11px] font-medium leading-tight',
                cookStatus === 'skipped' && 'line-through text-muted-foreground',
              )}
            >
              {entry.recipe.name}
            </span>
            {/* Member chip */}
            {member && (
              <span
                className="inline-flex w-fit items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-medium"
                style={memberAccentStyle(member.accent)}
              >
                <span className="size-1.5 rounded-full" aria-hidden style={memberDotStyle(member.accent)} />
                {member.name.split(' ')[0]}
              </span>
            )}
            {/* Status chip — compact cycling chip, same as list/accordion view */}
            <CookStatusChip
              status={cookStatus}
              onChange={({ status }) => onStatusChange({ day, meal, status, recipe: entry.recipe })}
              recipeName={entry.recipe.name}
            />
            {/* Reconcile / leftovers re-entry affordance — only on cooked slots
                with ingredients to reconcile */}
            {cookStatus === 'cooked' && entry.recipe.ingredients?.length ? (
              <button
                type="button"
                onClick={() => onOpenReconcile({ recipe: entry.recipe, key })}
                className="mt-0.5 flex items-center gap-1 text-[10px] text-muted-foreground hover:text-success transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 rounded"
                aria-label={`Reconcile leftovers for ${entry.recipe.name}`}
              >
                <Refrigerator className="size-3" aria-hidden />
                Reconcile / leftovers
              </button>
            ) : null}
          </div>
        )
      })}

      {/* +N more expand */}
      {!expanded && hiddenCount > 0 && (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="rounded-md px-1.5 py-1 text-[10px] font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition"
          aria-label={`Show ${hiddenCount} more recipe${hiddenCount > 1 ? 's' : ''} for ${day} ${meal}`}
        >
          +{hiddenCount} more
        </button>
      )}

      {/* Badges: alert + substitution */}
      {(hasAlert || isOverride) && (
        <div className="flex flex-wrap gap-1">
          {hasAlert && (
            <Badge
              variant="outline"
              className="gap-0.5 border-warning/40 bg-warning-tint text-warning text-[10px] px-1.5 py-0"
            >
              <AlertTriangle className="size-2.5" aria-hidden />
              Missing items
            </Badge>
          )}
          {isOverride && (
            <Badge
              variant="outline"
              className="gap-0.5 border-border bg-muted text-muted-foreground text-[10px] px-1.5 py-0"
            >
              <ArrowLeftRight className="size-2.5" aria-hidden />
              Substituted
            </Badge>
          )}
        </div>
      )}

      {/* Substitution panel toggle */}
      {isOverride && (
        <button
          type="button"
          onClick={() => setShowSub((v) => !v)}
          aria-expanded={showSub}
          aria-controls={subPanelId}
          className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground"
        >
          <ArrowLeftRight className="size-3" aria-hidden />
          {showSub ? 'Hide' : 'Show'} substitution
          <ChevronDown
            className={cn('size-3 transition-transform', showSub && 'rotate-180')}
            aria-hidden
          />
        </button>
      )}
      {showSub && isOverride && (
        <SubstitutionControl
          day={day}
          meal={meal}
          onClose={() => setShowSub(false)}
          panelId={subPanelId}
        />
      )}
    </div>
  )
}

// ── Mobile meal row (inside accordion) ───────────────────────────────────────
// CHANGE #2 + #3: stacks recipes compactly; cook-status is a CookStatusChip
// (cycling chip, icon-led); missing-items is a ⚠ icon with aria-label only.

const MobileMealRow = ({
  day,
  meal,
  entries,
  statuses,
  alertSlots,
  memberFilter,
  onStatusChange,
  onOpenReconcile,
}: {
  day: string
  meal: MealKey
  entries: MockSlotEntry[]
  statuses: SlotStatusMap
  alertSlots: Set<string>
  memberFilter: MemberFilter
  onStatusChange: ({ day, meal, status, recipe }: { day: string; meal: MealKey; status: CookStatus; recipe?: MockRecipe }) => void
  onOpenReconcile: ({ recipe, key }: { recipe: MockRecipe; key: string }) => void
}) => {
  const key = slotKey(day, meal)
  const isOverride = MOCK_INGREDIENT_OVERRIDE.day === day && MOCK_INGREDIENT_OVERRIDE.meal === meal
  const hasAlert = alertSlots.has(key)

  const visibleEntries = entries.filter((e) => {
    if (memberFilter === 'all') return true
    if (!e.targetMemberId) return true
    return e.targetMemberId === memberFilter
  })

  if (visibleEntries.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border bg-muted/30 px-3 py-2.5 text-xs text-muted-foreground">
        <span className="font-medium text-muted-foreground/70">{meal}</span>
        <span className="ml-2">No meal planned</span>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-border bg-card p-3">
      <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
        {meal}
      </span>
      {visibleEntries.map((entry, idx) => {
        const entryKey = `${key}-${idx}`
        const cookStatus = statuses.get(entryKey) ?? statuses.get(key) ?? 'planned'
        const member = MOCK_MEMBERS.find((m) => m.id === entry.targetMemberId)
        return (
          <div key={entryKey} className="flex items-start justify-between gap-2">
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <span
                className={cn(
                  'text-sm font-medium leading-tight',
                  cookStatus === 'skipped' && 'line-through text-muted-foreground',
                )}
              >
                {entry.recipe.name}
              </span>
              {member && (
                <span
                  className="inline-flex w-fit items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-medium"
                  style={memberAccentStyle(member.accent)}
                >
                  <span className="size-1.5 rounded-full" aria-hidden style={memberDotStyle(member.accent)} />
                  {member.name.split(' ')[0]}
                </span>
              )}
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {/* CHANGE #3: ⚠ icon-only for missing items — no text pill */}
              {hasAlert && cookStatus === 'planned' && (
                <span
                  className="text-warning"
                  aria-label={`Missing shopping items for ${day} ${meal}`}
                  role="img"
                >
                  <AlertTriangle className="size-4" aria-hidden />
                </span>
              )}
              {/* CHANGE #3: compact cycling chip instead of full segmented control */}
              <CookStatusChip
                status={cookStatus}
                onChange={({ status }) => onStatusChange({ day, meal, status, recipe: entry.recipe })}
                recipeName={entry.recipe.name}
              />
              {/* Substitution indicator — icon-only on mobile */}
              {isOverride && (
                <span className="text-muted-foreground" aria-label="Ingredient substituted">
                  <ArrowLeftRight className="size-3.5" aria-hidden />
                </span>
              )}
              {/* Reconcile affordance — icon-only on mobile */}
              {cookStatus === 'cooked' && entry.recipe.ingredients?.length ? (
                <button
                  type="button"
                  onClick={() => onOpenReconcile({ recipe: entry.recipe, key })}
                  className="text-muted-foreground hover:text-success transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
                  aria-label={`Reconcile leftovers for ${entry.recipe.name}`}
                >
                  <Refrigerator className="size-4" aria-hidden />
                </button>
              ) : null}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ── Reconciliation sheet state ────────────────────────────────────────────────
// Held at the screen level so the sheet can be opened from both the "mark cooked"
// action AND from the "Reconcile / leftovers" re-entry affordance on a cooked slot.
type ReconcileTarget = {
  recipe: MockRecipe
  slotKey: string
}

// ── Screen ────────────────────────────────────────────────────────────────────
export const MenuExecScreen = () => {
  const [memberFilter, setMemberFilter] = useState<MemberFilter>('all')
  const [viewMode, setViewMode] = useState<'calendar' | 'list'>('calendar')

  const [statuses, setStatuses] = useState<SlotStatusMap>(() => {
    const m = new Map<string, CookStatus>()
    for (const s of MOCK_SLOT_STATUSES) {
      m.set(slotKey(s.day, s.meal), s.cookStatus)
    }
    return m
  })

  // Reconciliation sheet state
  const [reconcileTarget, setReconcileTarget] = useState<ReconcileTarget | null>(null)
  // Pantry items accumulated from saved leftovers (mock-local; feeds inventory screen)
  const [pantryFromCooking, setPantryFromCooking] = useState<MockInventoryItem[]>([])

  const handleStatusChange = ({
    day,
    meal,
    status,
    recipe,
  }: {
    day: string
    meal: MealKey
    status: CookStatus
    recipe?: MockRecipe
  }) => {
    const key = slotKey(day, meal)
    setStatuses((prev) => new Map(prev).set(key, status))
    // When marking cooked and the recipe has ingredients, open the reconciliation sheet
    if (status === 'cooked' && recipe?.ingredients?.length) {
      setReconcileTarget({ recipe, slotKey: key })
    }
  }

  const handleReconcileSave = ({ leftovers }: { leftovers: MockInventoryItem[] }) => {
    setPantryFromCooking((prev) => [...prev, ...leftovers])
    setReconcileTarget(null)
  }

  const handleReconcileClose = () => {
    setReconcileTarget(null)
  }

  // Open reconcile sheet from the re-entry affordance on a cooked slot
  const openReconcile = ({ recipe, key }: { recipe: MockRecipe; key: string }) => {
    if (recipe.ingredients?.length) {
      setReconcileTarget({ recipe, slotKey: key })
    }
  }

  const alertSlots = new Set(
    MOCK_SLOT_STATUSES.filter((s) => s.hasShoppingAlert).map((s) => slotKey(s.day, s.meal)),
  )

  const totalCooked = [...statuses.values()].filter((s) => s === 'cooked').length
  const totalSlots = statuses.size

  // CHANGE #6: compute whether a day has any alert slot (for mobile accordion dot)
  const dayHasAlert = (day: string): boolean =>
    MEALS.some((meal) => alertSlots.has(slotKey(day, meal)))

  // ── Extracted layout pieces (defined once, reused in two wrappers) ──────────

  const weekGrid = (
    <div className="flex flex-col gap-3">
      {/* Meal column headers */}
      <div className="grid grid-cols-4 gap-2 text-xs font-medium text-muted-foreground">
        <span />
        {MEALS.map((m) => (
          <span key={m} className="text-center">
            {m}
          </span>
        ))}
      </div>

      {MOCK_WEEK.map(({ day, meals }) => (
        <div key={day} className="grid grid-cols-4 items-start gap-2">
          <div className="flex items-center pt-3 text-sm font-medium text-muted-foreground">
            {day}
          </div>
          {MEALS.map((meal) => {
            const slot = meals[meal]
            const key = slotKey(day, meal)

            return (
              <DesktopSlotCard
                key={key}
                day={day}
                meal={meal}
                entries={slot.entries}
                statuses={statuses}
                alertSlots={alertSlots}
                memberFilter={memberFilter}
                onStatusChange={handleStatusChange}
                onOpenReconcile={openReconcile}
              />
            )
          })}
        </div>
      ))}
    </div>
  )

  const weekAccordion = (
    <Accordion type="multiple" className="flex flex-col gap-2">
      {MOCK_WEEK.map(({ day, meals }) => {
        const alert = dayHasAlert(day)
        return (
          <AccordionItem
            key={day}
            value={day}
            className="overflow-hidden rounded-2xl border border-border bg-card cozy-card"
          >
            <AccordionTrigger className="px-4 py-3 hover:no-underline [&>svg]:ml-2">
              <div className="flex flex-1 items-center gap-2">
                <span className="text-sm font-semibold">{day}</span>
                {/* CHANGE #3: alert dot — icon only, accessible label */}
                {alert && (
                  <span
                    role="img"
                    aria-label={`${day} has meals with missing shopping items`}
                    className="text-warning"
                  >
                    <AlertTriangle className="size-3.5" aria-hidden />
                  </span>
                )}
              </div>
            </AccordionTrigger>
            <AccordionContent className="px-3 pb-3">
              <div className="flex flex-col gap-2 pt-1">
                {MEALS.map((meal) => {
                  const slot = meals[meal]
                  return (
                    <MobileMealRow
                      key={`${day}-${meal}`}
                      day={day}
                      meal={meal}
                      entries={slot.entries}
                      statuses={statuses}
                      alertSlots={alertSlots}
                      memberFilter={memberFilter}
                      onStatusChange={handleStatusChange}
                      onOpenReconcile={openReconcile}
                    />
                  )
                })}
              </div>
            </AccordionContent>
          </AccordionItem>
        )
      })}
    </Accordion>
  )

  return (
    <CozyShell active="menu" title="Weekly menu">
      {/* Cook-time reconciliation sheet — rendered at screen level so it's accessible
          from both the status chip and the re-entry affordance. */}
      <ReconcileSheet
        open={!!reconcileTarget}
        recipe={reconcileTarget?.recipe ?? null}
        onClose={handleReconcileClose}
        onSave={handleReconcileSave}
      />

      <div className="flex flex-col gap-5">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-col gap-0.5">
            <h2 className="text-base font-semibold">Week of Jun 9</h2>
            <p className="text-sm text-muted-foreground">
              {totalCooked} of {totalSlots} meals cooked
              {pantryFromCooking.length > 0 && (
                <span className="ml-2 inline-flex items-center gap-1 text-success">
                  ·{' '}
                  <Refrigerator className="size-3.5" aria-hidden />
                  {pantryFromCooking.length} item{pantryFromCooking.length > 1 ? 's' : ''} saved to pantry
                </span>
              )}
            </p>
          </div>
          <Badge variant="outline" className="bg-success-tint text-success border-transparent">
            Accepted
          </Badge>
        </div>

        {/* Member picker + desktop layout toggle — inline, same row on lg+ */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <MenuMemberPicker
            selected={memberFilter}
            onSelect={({ memberId }) => setMemberFilter(memberId)}
          />

          {/* Desktop-only segmented layout toggle */}
          <div
            className="hidden lg:flex items-center rounded-full bg-muted p-0.5"
            role="group"
            aria-label="Menu layout"
          >
            <button
              type="button"
              onClick={() => setViewMode('calendar')}
              aria-pressed={viewMode === 'calendar'}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1',
                viewMode === 'calendar'
                  ? 'bg-accent-tint text-accent-strong'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              <CalendarDays className="size-3.5 shrink-0" aria-hidden />
              Calendar
            </button>
            <button
              type="button"
              onClick={() => setViewMode('list')}
              aria-pressed={viewMode === 'list'}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1',
                viewMode === 'list'
                  ? 'bg-accent-tint text-accent-strong'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              <List className="size-3.5 shrink-0" aria-hidden />
              List
            </button>
          </div>
        </div>

        {/* Desktop content — calendar grid or day accordion depending on viewMode */}
        <div className="hidden lg:block">
          {viewMode === 'calendar' ? weekGrid : weekAccordion}
        </div>

        {/* Mobile / tablet — always day accordion, toggle never shown < lg */}
        <div className="lg:hidden">{weekAccordion}</div>

        {/* Alert summary */}
        {alertSlots.size > 0 && (
          <div className="flex items-start gap-2 rounded-2xl border border-warning/40 bg-warning-tint px-4 py-3">
            <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden />
            <div className="flex flex-col gap-0.5 text-sm">
              <span className="font-medium text-warning">Incomplete shopping alert</span>
              <span className="text-xs text-muted-foreground">
                {alertSlots.size} slot{alertSlots.size > 1 ? 's' : ''} may be affected by missing
                grocery items. Finish shopping or skip affected slots.
              </span>
            </div>
          </div>
        )}
      </div>
    </CozyShell>
  )
}
