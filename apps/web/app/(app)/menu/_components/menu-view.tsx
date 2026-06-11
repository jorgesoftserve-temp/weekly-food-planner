'use client'

import { useMemo, useState } from 'react'
import {
  AlertTriangle,
  ArrowLeftRight,
  Check,
  ChefHat,
  Lock,
  MoreHorizontal,
  Plus,
  Refrigerator,
  Repeat2,
} from 'lucide-react'
import type {
  DbTypes,
  MenuRecord,
  MenuSlotRecord,
} from '@weekly-food-planner/supabase'
import type { SlotShoppingAlert } from '@/lib/api/menu-alerts'
import { CookStatusChip } from './cook-status-chip'

type SlotCookStatus = DbTypes.SlotCookStatus
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { resolveRecipeIcon } from '@/lib/recipe-icon'

const DAY_ORDER: Record<string, number> = {
  monday: 0,
  tuesday: 1,
  wednesday: 2,
  thursday: 3,
  friday: 4,
  saturday: 5,
  sunday: 6,
}

const capitalize = (s: string): string =>
  s.length === 0 ? s : s.charAt(0).toUpperCase() + s.slice(1)

export type MenuViewProps = {
  menu: MenuRecord
  recipeNamesById: Record<string, string>
  memberNamesById?: Record<string, string>
  editable?: boolean
  onReplaceSlot?: (slot: MenuSlotRecord) => void
  onAddSlot?: (dayOfWeek: string) => void
  // When provided (active/accepted menu), each slot shows a Cook affordance
  // that opens the cook sheet for hands-on cooking + marking cooked.
  onCookSlot?: (slot: MenuSlotRecord) => void
  // (v2.0 Phase 3) Incomplete-shopping alerts keyed by slot id. When a slot has
  // an entry, it renders a "Missing items" warning listing the short ingredients.
  alertsBySlotId?: Record<string, SlotShoppingAlert>
  // (v2.0 Phase 4) Cook-status keyed by slot id (from slot_completions). Absent
  // entry = planned. When onSetCookStatus is provided each slot shows a cycling
  // cook-status chip (planned → cooked → skipped).
  cookStatusBySlotId?: Record<string, SlotCookStatus>
  onSetCookStatus?: ({ slot, status }: { slot: MenuSlotRecord; status: SlotCookStatus }) => void
  // (v2.0 Phase 5) Re-open the cook-time reconciliation / leftovers sheet for an
  // already-cooked slot. Shown only on cooked slots.
  onOpenReconcile?: (slot: MenuSlotRecord) => void
  // (v2.0 Phase 6) Open the ingredient-substitution sheet for a slot. When
  // provided each active-menu slot shows a "Substitute" affordance.
  onOpenSubstitute?: (slot: MenuSlotRecord) => void
  // (v2.0 Phase 6) Count of active ingredient overrides per slot id — drives the
  // "Substituted" badge.
  overrideCountBySlotId?: Record<string, number>
  // (v2.0 item 10) When set, render only this member's slots (plus shared
  // household slots). null = whole household (every slot).
  filterMemberId?: string | null
}

type DayBucket = { day: string; slots: MenuSlotRecord[] }

const DAYS_OF_WEEK = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
] as const

// Returns every day the menu covers, with its (possibly empty) slot list.
// Walks `durationDays` forward from `start_day_of_week`, wrapping Sun → Mon
// — matches the engine's enumerateMenuDays so the UI shows the same calendar
// as the engine planned. We need the full set (not just days that already
// have slots) so the user can add a slot on a day the engine left empty —
// e.g. a per-member menu where the child only had breakfast and the user
// wants to add lunch.
const groupByDay = ({
  slots,
  startDayOfWeek,
  durationDays,
}: {
  slots: MenuSlotRecord[]
  startDayOfWeek: string
  durationDays: number
}): DayBucket[] => {
  const startIdx = DAY_ORDER[startDayOfWeek] ?? 0
  const clamped = Math.max(1, Math.min(7, Math.floor(durationDays)))
  const orderedDays: string[] = []
  for (let i = 0; i < clamped; i++) {
    const day = DAYS_OF_WEEK[(startIdx + i) % 7]
    if (day) orderedDays.push(day)
  }
  const byDay = new Map<string, MenuSlotRecord[]>()
  for (const day of orderedDays) byDay.set(day, [])
  for (const slot of slots) {
    const list = byDay.get(slot.day_of_week)
    if (list) list.push(slot)
    else byDay.set(slot.day_of_week, [slot])
  }
  for (const [, list] of byDay) {
    list.sort((a, b) => a.meal_key.localeCompare(b.meal_key))
  }
  return orderedDays.map((day) => ({
    day,
    slots: byDay.get(day) ?? [],
  }))
}

const formatMissing = (alert: SlotShoppingAlert): string =>
  alert.missingIngredients
    .map((m) => `${m.name} (short ${m.shortfall} ${m.unit})`)
    .join(', ')

const SlotCard = ({
  slot,
  recipeName,
  memberName,
  editable,
  onReplaceSlot,
  onCookSlot,
  alert,
  cookStatus,
  onSetCookStatus,
  onOpenReconcile,
  onOpenSubstitute,
  overrideCount = 0,
}: {
  slot: MenuSlotRecord
  recipeName: string
  memberName: string | null
  editable: boolean
  onReplaceSlot?: (slot: MenuSlotRecord) => void
  onCookSlot?: (slot: MenuSlotRecord) => void
  alert?: SlotShoppingAlert
  // (v2.0 Phase 4) cook-status from slot_completions; falls back to cooked_at.
  cookStatus: SlotCookStatus
  onSetCookStatus?: ({ slot, status }: { slot: MenuSlotRecord; status: SlotCookStatus }) => void
  onOpenReconcile?: (slot: MenuSlotRecord) => void
  onOpenSubstitute?: (slot: MenuSlotRecord) => void
  overrideCount?: number
}) => {
  const icon = resolveRecipeIcon({ name: recipeName, meal: slot.meal_key })
  const cooked = cookStatus === 'cooked'
  const skipped = cookStatus === 'skipped'
  return (
    <div
      className={cn(
        'flex items-start gap-2 rounded-xl border border-border bg-background p-2',
        skipped && 'opacity-60',
      )}
    >
      <div
        className={cn(
          'flex size-9 shrink-0 items-center justify-center rounded-lg text-lg',
          cooked
            ? 'bg-success-tint ring-2 ring-success ring-offset-1 ring-offset-background'
            : 'bg-muted',
        )}
        aria-hidden
      >
        {icon}
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <div className="flex items-center gap-1.5">
          <span className="text-xs uppercase tracking-wide text-muted-foreground">
            {slot.meal_key}
          </span>
          {cooked ? (
            <span className="flex items-center gap-0.5 rounded-full bg-success-tint px-1.5 py-0.5 text-[10px] font-medium uppercase text-success">
              <Check className="size-2.5" aria-hidden />
              Cooked
            </span>
          ) : null}
          {slot.is_overridden ? (
            <span
              title="User-overridden slot"
              className="flex items-center gap-0.5 rounded-full bg-warning-tint px-1.5 py-0.5 text-[10px] font-medium uppercase text-warning"
            >
              <Lock className="size-2.5" aria-hidden />
              Modified
            </span>
          ) : null}
          {overrideCount > 0 ? (
            <span
              title={`${overrideCount} ingredient substitution${overrideCount === 1 ? '' : 's'}`}
              className="flex items-center gap-0.5 rounded-full bg-success-tint px-1.5 py-0.5 text-[10px] font-medium uppercase text-success"
            >
              <ArrowLeftRight className="size-2.5" aria-hidden />
              Substituted
            </span>
          ) : null}
          {alert && cookStatus === 'planned' ? (
            <span
              title={`Missing for this meal: ${formatMissing(alert)}`}
              className="flex items-center gap-0.5 rounded-full bg-destructive/10 px-1.5 py-0.5 text-[10px] font-medium uppercase text-destructive"
            >
              <AlertTriangle className="size-2.5" aria-hidden />
              Missing items
            </span>
          ) : null}
        </div>
        <span
          className={cn(
            'break-words text-sm font-medium leading-tight',
            skipped && 'text-muted-foreground line-through',
          )}
        >
          {recipeName}
        </span>
        {alert && cookStatus === 'planned' ? (
          <span className="break-words text-xs leading-tight text-destructive">
            Short on {alert.missingIngredients.map((m) => m.name).join(', ')}
          </span>
        ) : null}
        {memberName ? (
          <span className="truncate text-xs text-muted-foreground">
            For {memberName}
          </span>
        ) : null}
      </div>
      {editable ? (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="size-9 shrink-0"
              aria-label={`Actions for ${recipeName} (${slot.meal_key})`}
            >
              <MoreHorizontal className="size-4" aria-hidden />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              onSelect={(event) => {
                event.preventDefault()
                onReplaceSlot?.(slot)
              }}
            >
              <Repeat2 className="mr-2 size-4" />
              Replace recipe
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ) : onSetCookStatus || onCookSlot ? (
        <div className="flex shrink-0 flex-col items-end gap-1.5">
          {onSetCookStatus ? (
            <CookStatusChip
              status={cookStatus}
              recipeName={recipeName}
              onChange={({ status }) => onSetCookStatus({ slot, status })}
            />
          ) : null}
          {onCookSlot ? (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 shrink-0 gap-1 px-2 text-xs text-muted-foreground"
              onClick={() => onCookSlot(slot)}
              aria-label={`Open cook mode for ${recipeName} (${slot.meal_key})`}
            >
              <ChefHat className="size-3.5" aria-hidden />
              Cook mode
            </Button>
          ) : null}
          {cooked && onOpenReconcile ? (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 shrink-0 gap-1 px-2 text-xs text-muted-foreground"
              onClick={() => onOpenReconcile(slot)}
              aria-label={`Reconcile leftovers for ${recipeName} (${slot.meal_key})`}
            >
              <Refrigerator className="size-3.5" aria-hidden />
              Reconcile / leftovers
            </Button>
          ) : null}
          {onOpenSubstitute ? (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 shrink-0 gap-1 px-2 text-xs text-muted-foreground"
              onClick={() => onOpenSubstitute(slot)}
              aria-label={`Substitute an ingredient for ${recipeName} (${slot.meal_key})`}
            >
              <ArrowLeftRight className="size-3.5" aria-hidden />
              Substitute
            </Button>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}

export const MenuView = ({
  menu,
  recipeNamesById,
  memberNamesById,
  editable = false,
  onReplaceSlot,
  onAddSlot,
  onCookSlot,
  alertsBySlotId,
  cookStatusBySlotId,
  onSetCookStatus,
  onOpenReconcile,
  onOpenSubstitute,
  overrideCountBySlotId,
  filterMemberId = null,
}: MenuViewProps) => {
  // (v2.0 item 10) Per-member filter: keep the member's targeted slots plus any
  // shared household slots (target_member_id === null), which everyone eats.
  const visibleSlots = useMemo(() => {
    if (filterMemberId === null) return menu.menu_slots
    return menu.menu_slots.filter(
      (s) => s.target_member_id === filterMemberId || s.target_member_id === null,
    )
  }, [menu.menu_slots, filterMemberId])
  const buckets = useMemo(
    () =>
      groupByDay({
        slots: visibleSlots,
        startDayOfWeek: menu.start_day_of_week,
        durationDays: menu.duration_days,
      }),
    [visibleSlots, menu.start_day_of_week, menu.duration_days],
  )
  const initialDay =
    buckets[0]?.day && DAY_ORDER[buckets[0].day] !== undefined ? buckets[0].day : 'monday'
  const [activeDay, setActiveDay] = useState<string>(initialDay)

  const resolveRecipeName = (slot: MenuSlotRecord): string =>
    recipeNamesById[slot.recipe_id] ??
    `[unknown:${slot.recipe_id.slice(0, 6)}]`

  const resolveMemberName = (slot: MenuSlotRecord): string | null => {
    if (!slot.target_member_id) return null
    if (!memberNamesById) return null
    return memberNamesById[slot.target_member_id] ?? null
  }

  const overrideCount = menu.menu_slots.filter((s) => s.is_overridden).length

  // Participants and frequency-override pills surface the new Phase 2 metadata
  // so the menu page reflects what shaped this generation. participants is
  // sourced from the structural junction; freq override count is read off
  // generation_options for audit (PRODUCT_PRD §4.3 + DATABASE_PRD §6.11.1).
  const participantCount = menu.menu_participants?.length ?? 0
  const frequencyOverrideCount = (() => {
    const opts = menu.generation_options
    if (!opts || typeof opts !== 'object') return 0
    const overrides = (opts as { memberFrequencyOverrides?: unknown[] })
      .memberFrequencyOverrides
    return Array.isArray(overrides) ? overrides.length : 0
  })()

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-xl border border-border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
          <span>
            <span className="font-medium text-foreground">Week starting:</span>{' '}
            {menu.week_start_date}
          </span>
          <span>
            <span className="font-medium text-foreground">Type:</span>{' '}
            <span className="capitalize">{menu.menu_type}</span>
          </span>
          <span>
            <span className="font-medium text-foreground">Duration:</span>{' '}
            {menu.duration_days} day{menu.duration_days === 1 ? '' : 's'}
          </span>
          {menu.seed !== null ? (
            <span>
              <span className="font-medium text-foreground">Seed:</span>{' '}
              <code className="rounded bg-muted px-1 py-0.5 text-xs">
                {menu.seed}
              </code>
            </span>
          ) : null}
          {menu.inputs_hash ? (
            <span>
              <span className="font-medium text-foreground">Inputs hash:</span>{' '}
              <code className="rounded bg-muted px-1 py-0.5 text-xs">
                {menu.inputs_hash.slice(0, 12)}…
              </code>
            </span>
          ) : null}
          {overrideCount > 0 ? (
            <span className="text-warning">
              {overrideCount} slot{overrideCount === 1 ? '' : 's'} modified
            </span>
          ) : null}
          {participantCount > 0 ? (
            <span>
              <span className="font-medium text-foreground">Cooking for:</span>{' '}
              {participantCount} member{participantCount === 1 ? '' : 's'}
            </span>
          ) : null}
          {frequencyOverrideCount > 0 ? (
            <span className="text-warning">
              Schedule customized ({frequencyOverrideCount})
            </span>
          ) : null}
        </div>
      </div>

      {/* Mobile: day-picker + single day card */}
      <div className="md:hidden">
        <div
          className="-mx-1 mb-3 flex gap-1 overflow-x-auto px-1 pb-1"
          role="tablist"
          aria-label="Day picker"
        >
          {buckets.map(({ day }) => {
            const isActive = day === activeDay
            return (
              <button
                key={day}
                role="tab"
                type="button"
                aria-selected={isActive}
                onClick={() => setActiveDay(day)}
                className={`shrink-0 rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                  isActive
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-border bg-card/40 text-muted-foreground hover:text-foreground'
                }`}
              >
                {capitalize(day).slice(0, 3)}
              </button>
            )
          })}
        </div>
        {buckets
          .filter((b) => b.day === activeDay)
          .map((bucket) => (
            <Card key={bucket.day}>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">
                  {capitalize(bucket.day)}
                </CardTitle>
                <CardDescription>
                  {bucket.slots.length}{' '}
                  {bucket.slots.length === 1 ? 'meal' : 'meals'}
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-2">
                {bucket.slots.map((slot) => (
                  <SlotCard
                    key={slot.id}
                    slot={slot}
                    recipeName={resolveRecipeName(slot)}
                    memberName={resolveMemberName(slot)}
                    editable={editable}
                    onReplaceSlot={onReplaceSlot}
                    onCookSlot={onCookSlot}
                    alert={alertsBySlotId?.[slot.id]}
                    cookStatus={
                      cookStatusBySlotId?.[slot.id] ??
                      (slot.cooked_at ? 'cooked' : 'planned')
                    }
                    onSetCookStatus={onSetCookStatus}
                    onOpenReconcile={onOpenReconcile}
                    onOpenSubstitute={onOpenSubstitute}
                    overrideCount={overrideCountBySlotId?.[slot.id] ?? 0}
                  />
                ))}
                {editable && onAddSlot ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => onAddSlot(bucket.day)}
                    className="justify-start text-muted-foreground"
                  >
                    <Plus className="size-4" />
                    Add meal
                  </Button>
                ) : null}
              </CardContent>
            </Card>
          ))}
      </div>

      {/* Desktop: full grid */}
      <div className="hidden gap-4 md:grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {buckets.map((bucket) => (
          <Card key={bucket.day}>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">
                {capitalize(bucket.day)}
              </CardTitle>
              <CardDescription>
                {bucket.slots.length}{' '}
                {bucket.slots.length === 1 ? 'meal' : 'meals'}
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
              {bucket.slots.map((slot) => (
                <SlotCard
                  key={slot.id}
                  slot={slot}
                  recipeName={resolveRecipeName(slot)}
                  memberName={resolveMemberName(slot)}
                  editable={editable}
                  onReplaceSlot={onReplaceSlot}
                  onCookSlot={onCookSlot}
                  alert={alertsBySlotId?.[slot.id]}
                  cookStatus={
                    cookStatusBySlotId?.[slot.id] ??
                    (slot.cooked_at ? 'cooked' : 'planned')
                  }
                  onSetCookStatus={onSetCookStatus}
                />
              ))}
              {editable && onAddSlot ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => onAddSlot(bucket.day)}
                  className="justify-start text-muted-foreground"
                >
                  <Plus className="size-4" />
                  Add meal
                </Button>
              ) : null}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
