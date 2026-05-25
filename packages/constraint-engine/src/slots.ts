import type {
  DayOfWeek,
  GenerateMenuInput,
  MealType,
  MemberSnapshot,
  WorkspaceSnapshot,
} from './types.js'

export type SlotSpec = {
  dayOfWeek: DayOfWeek
  mealKey: string
  mealType: MealType
  targetMemberId: string
}

const DAYS_OF_WEEK: readonly DayOfWeek[] = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
] as const

const DAY_ORDER: Record<DayOfWeek, number> = {
  monday: 0,
  tuesday: 1,
  wednesday: 2,
  thursday: 3,
  friday: 4,
  saturday: 5,
  sunday: 6,
}

const resolveFrequency = ({
  member,
  workspace,
}: {
  member: MemberSnapshot
  workspace: WorkspaceSnapshot
}) => {
  if (member.mealFrequency && member.mealFrequency.length > 0) {
    return member.mealFrequency
  }
  return workspace.sharedMealFrequency ?? []
}

// MVP simplification: every slot is per-member. A future iteration can detect
// when multiple members get the same recipe for the same (day, mealKey) and
// collapse those into a shared slot in the output.
export const buildSlots = ({ input }: { input: GenerateMenuInput }): SlotSpec[] => {
  const slots: SlotSpec[] = []
  for (const member of input.members) {
    const frequency = resolveFrequency({ member, workspace: input.workspace })
    for (const day of DAYS_OF_WEEK) {
      for (const entry of frequency) {
        slots.push({
          dayOfWeek: day,
          mealKey: entry.key,
          mealType: entry.mealType,
          targetMemberId: member.id,
        })
      }
    }
  }
  slots.sort((a, b) => {
    if (a.dayOfWeek !== b.dayOfWeek) return DAY_ORDER[a.dayOfWeek] - DAY_ORDER[b.dayOfWeek]
    if (a.mealKey !== b.mealKey) return a.mealKey.localeCompare(b.mealKey)
    return a.targetMemberId.localeCompare(b.targetMemberId)
  })
  return slots
}
