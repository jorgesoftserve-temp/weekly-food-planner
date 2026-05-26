'use client'

import { useMemo, useState } from 'react'
import { Lock, MoreHorizontal, Repeat2 } from 'lucide-react'
import type { MenuRecord, MenuSlotRecord } from '@weekly-food-planner/supabase'
import { Button } from '@/components/ui/button'
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
}

type DayBucket = { day: string; slots: MenuSlotRecord[] }

const groupByDay = (slots: MenuSlotRecord[]): DayBucket[] => {
  const map = new Map<string, MenuSlotRecord[]>()
  for (const slot of slots) {
    const list = map.get(slot.day_of_week) ?? []
    list.push(slot)
    map.set(slot.day_of_week, list)
  }
  for (const [, list] of map) {
    list.sort((a, b) => a.meal_key.localeCompare(b.meal_key))
  }
  return Array.from(map.entries())
    .sort(([a], [b]) => (DAY_ORDER[a] ?? 99) - (DAY_ORDER[b] ?? 99))
    .map(([day, dSlots]) => ({ day, slots: dSlots }))
}

const SlotCard = ({
  slot,
  recipeName,
  memberName,
  editable,
  onReplaceSlot,
}: {
  slot: MenuSlotRecord
  recipeName: string
  memberName: string | null
  editable: boolean
  onReplaceSlot?: (slot: MenuSlotRecord) => void
}) => {
  return (
    <div className="flex items-start justify-between gap-2 rounded-md border border-border p-2">
      <div className="flex min-w-0 flex-col gap-0.5">
        <div className="flex items-center gap-1.5">
          <span className="text-xs uppercase tracking-wide text-muted-foreground">
            {slot.meal_key}
          </span>
          {slot.is_overridden ? (
            <span
              title="User-overridden slot"
              className="flex items-center gap-0.5 rounded-sm bg-amber-500/10 px-1 py-0.5 text-[10px] font-medium uppercase text-amber-700 dark:text-amber-300"
            >
              <Lock className="size-2.5" />
              Modified
            </span>
          ) : null}
        </div>
        <span className="break-words text-sm font-medium">{recipeName}</span>
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
              className="size-7 shrink-0"
              aria-label={`Slot actions for ${slot.meal_key}`}
            >
              <MoreHorizontal className="size-4" />
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
}: MenuViewProps) => {
  const buckets = useMemo(() => groupByDay(menu.menu_slots), [menu.menu_slots])
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

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-md border border-border bg-card/40 px-4 py-3 text-sm text-muted-foreground">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
          <span>
            <span className="font-medium text-foreground">Week starting:</span>{' '}
            {menu.week_start_date}
          </span>
          <span>
            <span className="font-medium text-foreground">Seed:</span>{' '}
            <code className="rounded bg-muted px-1 py-0.5 text-xs">
              {menu.seed}
            </code>
          </span>
          <span>
            <span className="font-medium text-foreground">Inputs hash:</span>{' '}
            <code className="rounded bg-muted px-1 py-0.5 text-xs">
              {menu.inputs_hash.slice(0, 12)}…
            </code>
          </span>
          {overrideCount > 0 ? (
            <span className="text-amber-700 dark:text-amber-300">
              {overrideCount} slot{overrideCount === 1 ? '' : 's'} modified
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
                  />
                ))}
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
                />
              ))}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
