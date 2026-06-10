'use client'

import { cn } from '@/lib/utils'
import type { MemberRecord } from '@weekly-food-planner/supabase'
import { deriveAccentFromId } from '../../members/_components/derive-accent'

type MemberSelectorProps = {
  members: MemberRecord[]
  selectedMemberId: string | null
  onSelect: ({ memberId }: { memberId: string | null }) => void
}

// Per-member accent chip — uses the data-accent token mechanism identical to
// member-card.tsx. The data-accent attribute on each button scopes
// --user-accent* to that element's subtree so bg-accent-tint / text-accent-strong
// / ring-user-accent resolve to that member's color. No inline hex.
export const MemberSelector = ({
  members,
  selectedMemberId,
  onSelect,
}: MemberSelectorProps) => {
  return (
    <div className="flex flex-col gap-2">
      <span className="text-sm font-medium text-muted-foreground">
        Viewing menu for
      </span>
      <div className="flex flex-wrap gap-2">
        {/* "Everyone" chip — uses workspace accent (no data-accent needed) */}
        <button
          type="button"
          onClick={() => onSelect({ memberId: null })}
          className={cn(
            'inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm transition-colors',
            selectedMemberId === null
              ? 'bg-accent-tint text-accent-strong font-medium'
              : 'border border-border text-muted-foreground hover:bg-muted',
          )}
        >
          Everyone
        </button>

        {members.map((member) => {
          const isSelected = member.id === selectedMemberId
          const accentKey = member.accent_color ?? deriveAccentFromId(member.id)

          return (
            // data-accent scopes --user-accent* to this button's subtree only.
            <button
              key={member.id}
              type="button"
              data-accent={isSelected ? accentKey : undefined}
              onClick={() => onSelect({ memberId: member.id })}
              className={cn(
                'inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm transition-colors',
                isSelected
                  ? 'bg-accent-tint text-accent-strong font-medium ring-1 ring-user-accent'
                  : 'border border-border text-muted-foreground hover:bg-muted',
              )}
            >
              {!isSelected ? (
                // Accent dot on unselected chips — scoped wrapper so the dot
                // can read its own accent even when the button isn't selected.
                <span
                  data-accent={accentKey}
                  className="size-2 shrink-0 rounded-full bg-user-accent"
                  aria-hidden="true"
                />
              ) : null}
              {member.name.split(' ')[0]}
            </button>
          )
        })}
      </div>
    </div>
  )
}
