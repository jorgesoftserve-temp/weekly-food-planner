import type {
  DayOfWeek,
  GenerateMenuInput,
  MealFrequencyEntry,
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

// Compute the wall-clock moment a slot starts, interpreted in the server's
// local timezone. The engine is naive about timezones — it assumes the user
// generating the menu lives in the same zone as the server, which holds for
// the single-tenant MVP. Multi-zone support would require carrying a tz on the
// workspace or member.
const slotStart = ({
  weekStartDate,
  dayOfWeek,
  defaultHour,
}: {
  weekStartDate: string
  dayOfWeek: DayOfWeek
  defaultHour: number
}): number => {
  const [y, m, d] = weekStartDate.split('-').map((part) => Number.parseInt(part, 10))
  if (!y || !m || !d) return Number.POSITIVE_INFINITY
  const dayOffset = DAY_ORDER[dayOfWeek]
  return new Date(y, m - 1, d + dayOffset, defaultHour, 0, 0, 0).getTime()
}

const isSlotPast = ({
  weekStartDate,
  dayOfWeek,
  entry,
  nowMs,
}: {
  weekStartDate: string
  dayOfWeek: DayOfWeek
  entry: MealFrequencyEntry
  nowMs: number
}): boolean => {
  const start = slotStart({
    weekStartDate,
    dayOfWeek,
    defaultHour: entry.defaultHour,
  })
  return start < nowMs
}

// MVP simplification: every slot is per-member. A future iteration can detect
// when multiple members get the same recipe for the same (day, mealKey) and
// collapse those into a shared slot in the output.
export const buildSlots = ({ input }: { input: GenerateMenuInput }): SlotSpec[] => {
  const nowMs = input.now ? new Date(input.now).getTime() : null
  const slots: SlotSpec[] = []
  for (const member of input.members) {
    const frequency = resolveFrequency({ member, workspace: input.workspace })
    for (const day of DAYS_OF_WEEK) {
      for (const entry of frequency) {
        if (
          nowMs !== null &&
          isSlotPast({
            weekStartDate: input.weekStartDate,
            dayOfWeek: day,
            entry,
            nowMs,
          })
        ) {
          continue
        }
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
