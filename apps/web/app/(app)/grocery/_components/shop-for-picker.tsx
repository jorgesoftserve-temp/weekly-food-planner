'use client'

import { useMemo } from 'react'
import { Users } from 'lucide-react'
import { Button } from '@/components/ui/button'

export type ShopForPickerProps = {
  // The full list of members the menu was generated for. Drives the chip set.
  participantIds: string[]
  memberNamesById: Record<string, string>
  // Current selection. `null` = no filter (everyone). An empty array would be
  // a UX dead-end so we treat it the same as null.
  selectedIds: string[] | null
  onChange: (next: string[] | null) => void
}

// Multi-select chips for "Shop for which members?". null state = whole menu
// (default). The grocery page rescales the shared list and filters the
// per-member buckets when the selection is a proper subset of the menu's
// participants — see lib/grocery-filter.ts for the math.
export const ShopForPicker = ({
  participantIds,
  memberNamesById,
  selectedIds,
  onChange,
}: ShopForPickerProps) => {
  const effective = useMemo(
    () => new Set(selectedIds ?? participantIds),
    [selectedIds, participantIds],
  )
  const isWholeHousehold =
    selectedIds === null || effective.size === participantIds.length
  const toggle = (memberId: string) => {
    const next = new Set(effective)
    if (next.has(memberId)) next.delete(memberId)
    else next.add(memberId)
    if (next.size === 0) {
      // Don't let the user opt nobody in — collapse back to "whole household".
      onChange(null)
      return
    }
    if (next.size === participantIds.length) {
      onChange(null)
      return
    }
    onChange(Array.from(next))
  }

  if (participantIds.length === 0) return null

  return (
    <div className="flex flex-col gap-2 rounded-md border border-border bg-card/40 px-4 py-3 text-sm">
      <div className="flex items-center gap-2 text-muted-foreground">
        <Users className="size-4" />
        <span className="font-medium text-foreground">Shop for</span>
        <span className="text-xs">
          {isWholeHousehold
            ? `Whole household (${participantIds.length})`
            : `${effective.size} of ${participantIds.length} members`}
        </span>
        {!isWholeHousehold ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="ml-auto h-7"
            onClick={() => onChange(null)}
          >
            Reset
          </Button>
        ) : null}
      </div>
      <div className="flex flex-wrap gap-2">
        {participantIds.map((memberId) => {
          const isOn = effective.has(memberId)
          return (
            <Button
              key={memberId}
              type="button"
              variant={isOn ? 'default' : 'outline'}
              size="sm"
              aria-pressed={isOn}
              onClick={() => toggle(memberId)}
            >
              {memberNamesById[memberId] ?? memberId.slice(0, 6)}
            </Button>
          )
        })}
      </div>
      {!isWholeHousehold ? (
        <p className="text-xs text-muted-foreground">
          Shared quantities are scaled by{' '}
          <span className="font-mono">
            {effective.size}/{participantIds.length}
          </span>
          . Per-member buckets only show selected members. Export still
          downloads the full list.
        </p>
      ) : null}
    </div>
  )
}
