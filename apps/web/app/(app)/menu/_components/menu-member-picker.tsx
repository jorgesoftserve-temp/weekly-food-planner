'use client'

import { Users } from 'lucide-react'
import { cn } from '@/lib/utils'

export type MenuMemberPickerProps = {
  // Members the menu was generated for (drives the chip set).
  participantIds: string[]
  memberNamesById: Record<string, string>
  // null = whole household (show every slot). Otherwise filter to one member.
  selectedId: string | null
  onChange: (next: string | null) => void
}

// (v2.0 item 10) Single-select member/household switcher for the weekly menu —
// the menu-screen mirror of the grocery shop-for picker. Filters the rendered
// slots to one member (plus shared household meals) or shows everyone.
export const MenuMemberPicker = ({
  participantIds,
  memberNamesById,
  selectedId,
  onChange,
}: MenuMemberPickerProps) => {
  if (participantIds.length === 0) return null

  const chip = (active: boolean) =>
    cn(
      'inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-medium transition',
      active
        ? 'bg-accent-tint text-accent-strong'
        : 'border border-border text-muted-foreground hover:bg-muted',
    )

  return (
    <div className="flex flex-col gap-2">
      <span className="text-xs font-medium text-muted-foreground">View menu for</span>
      <div className="flex flex-wrap gap-2" role="group" aria-label="Menu member view">
        <button
          type="button"
          onClick={() => onChange(null)}
          aria-pressed={selectedId === null}
          className={chip(selectedId === null)}
        >
          <Users className="size-3.5" aria-hidden />
          Everyone
        </button>
        {participantIds.map((memberId) => {
          const name = memberNamesById[memberId] ?? 'Member'
          return (
            <button
              key={memberId}
              type="button"
              onClick={() => onChange(memberId)}
              aria-pressed={selectedId === memberId}
              className={chip(selectedId === memberId)}
            >
              {name.split(' ')[0]}
            </button>
          )
        })}
      </div>
    </div>
  )
}
