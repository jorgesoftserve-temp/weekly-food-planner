'use client'

import { useMemo } from 'react'
import { RotateCcw } from 'lucide-react'
import { useMembersList } from '@weekly-food-planner/supabase/react'
import type {
  MealFrequencyEntry,
  MemberRecord,
} from '@weekly-food-planner/supabase'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { MealFrequencyFields } from '@/components/forms/meal-frequency-fields'
import { useSupabase } from '@/lib/hooks/use-supabase'

// Sensible per-menu default when a member has neither their own meal
// frequency nor a workspace shared frequency. Mirrors the default the
// member-form ships in Phase 1.
const DEFAULT_FREQUENCY: MealFrequencyEntry[] = [
  { key: 'breakfast', title: 'Breakfast', mealType: 'breakfast', defaultHour: 7 },
  { key: 'lunch', title: 'Lunch', mealType: 'lunch', defaultHour: 12 },
  { key: 'dinner', title: 'Dinner', mealType: 'dinner', defaultHour: 19 },
]

export type FrequencyOverrideEntry = {
  memberId: string
  mealFrequency: MealFrequencyEntry[]
}

export type ParticipantsFrequencyPanelProps = {
  workspaceId: string
  // null = "no one explicitly picked yet → defaults to everyone in the UI but
  // submits as undefined so the server applies its own everyone default".
  participantIds: string[] | null
  onParticipantsChange: (next: string[] | null) => void
  // Map memberId → effective frequency. A missing memberId means the member's
  // profile / workspace default is used (no override sent for them).
  overrides: FrequencyOverrideEntry[]
  onOverridesChange: (next: FrequencyOverrideEntry[]) => void
}

const resolveBaselineFrequency = (
  member: MemberRecord,
): MealFrequencyEntry[] => {
  if (member.meal_frequency && member.meal_frequency.length > 0) {
    return member.meal_frequency
  }
  return DEFAULT_FREQUENCY
}

// Panel embedded inside the generate-menu dialog. Two concerns in one place:
//   1. Which members this menu is for (PRODUCT_PRD §4.3 — subset of household).
//   2. Per-member meal-frequency override for this generation only.
// Members not in the participants list are hidden from the override editor —
// you can't tweak frequencies for someone the menu isn't for.
export const ParticipantsFrequencyPanel = ({
  workspaceId,
  participantIds,
  onParticipantsChange,
  overrides,
  onOverridesChange,
}: ParticipantsFrequencyPanelProps) => {
  const supabase = useSupabase()
  const membersQuery = useMembersList({ supabase, workspaceId })
  const members = membersQuery.data ?? []
  const overridesByMember = useMemo(() => {
    const map = new Map<string, MealFrequencyEntry[]>()
    for (const entry of overrides) map.set(entry.memberId, entry.mealFrequency)
    return map
  }, [overrides])

  const effectiveParticipants = participantIds ?? members.map((m) => m.id)
  const participantSet = new Set(effectiveParticipants)

  const toggleParticipant = (memberId: string) => {
    const current = new Set(effectiveParticipants)
    if (current.has(memberId)) current.delete(memberId)
    else current.add(memberId)
    onParticipantsChange(Array.from(current))
    // A member dropped from participants loses any in-flight override.
    if (!current.has(memberId)) {
      onOverridesChange(overrides.filter((o) => o.memberId !== memberId))
    }
  }

  const setOverrideFor = (memberId: string, next: MealFrequencyEntry[]) => {
    const others = overrides.filter((o) => o.memberId !== memberId)
    onOverridesChange([...others, { memberId, mealFrequency: next }])
  }

  const clearOverrideFor = (memberId: string) => {
    onOverridesChange(overrides.filter((o) => o.memberId !== memberId))
  }

  if (membersQuery.isLoading) {
    return (
      <p className="text-sm text-muted-foreground">Loading household…</p>
    )
  }
  if (members.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No household members yet — add at least one in the Members page.
      </p>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label className="text-xs">Cooking for</Label>
        <div className="flex flex-wrap gap-2">
          {members.map((member) => {
            const isOn = participantSet.has(member.id)
            return (
              <Button
                key={member.id}
                type="button"
                variant={isOn ? 'default' : 'outline'}
                size="sm"
                onClick={() => toggleParticipant(member.id)}
              >
                {member.name}
              </Button>
            )
          })}
        </div>
        <p className="text-xs text-muted-foreground">
          Skip members who aren&apos;t eating from this menu. The grocery list
          will be sized to the people you pick.
        </p>
      </div>

      <div className="flex flex-col gap-3">
        <Label className="text-xs">Per-member meal schedule (this menu only)</Label>
        <div className="flex flex-col gap-3">
          {members
            .filter((m) => participantSet.has(m.id))
            .map((member) => {
              const overrideForMember = overridesByMember.get(member.id)
              const baseline = resolveBaselineFrequency(member)
              const value = overrideForMember ?? baseline
              const hasOverride = overrideForMember !== undefined
              return (
                <div
                  key={member.id}
                  className="flex flex-col gap-2 rounded-md border border-border bg-card/40 p-3"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex flex-col">
                      <span className="text-sm font-medium">{member.name}</span>
                      <span className="text-xs text-muted-foreground">
                        {hasOverride
                          ? 'Customized for this menu'
                          : member.meal_frequency
                            ? 'Using profile schedule'
                            : 'Using workspace default'}
                      </span>
                    </div>
                    {hasOverride ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => clearOverrideFor(member.id)}
                      >
                        <RotateCcw className="size-4" />
                        Reset
                      </Button>
                    ) : (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setOverrideFor(member.id, value)}
                      >
                        Customize
                      </Button>
                    )}
                  </div>
                  {hasOverride ? (
                    <MealFrequencyFields
                      value={value}
                      onChange={(next) => setOverrideFor(member.id, next)}
                    />
                  ) : null}
                </div>
              )
            })}
        </div>
      </div>
    </div>
  )
}
