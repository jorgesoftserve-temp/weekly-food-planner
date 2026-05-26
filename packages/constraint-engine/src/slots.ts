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

const MAX_DURATION = 7
const DEFAULT_DURATION = 7

// Cascade for a member's meal frequency:
//   1. per-menu override (`options.memberFrequencyOverrides[memberId]`)
//   2. member's own `meal_frequency`
//   3. workspace `sharedMealFrequency`
//   4. empty (no slots for this member)
// An override with an empty array IS honoured at step 1 — it means "skip
// this member entirely for this menu" rather than "fall through to the
// member's profile default". This is the path PRODUCT_PRD §4.3 calls out
// for the houseguest-only / kid-skips-dinner scenarios.
const resolveFrequency = ({
  member,
  workspace,
  overridesByMember,
}: {
  member: MemberSnapshot
  workspace: WorkspaceSnapshot
  overridesByMember: Map<string, MealFrequencyEntry[]>
}) => {
  const override = overridesByMember.get(member.id)
  if (override !== undefined) return override
  if (member.mealFrequency && member.mealFrequency.length > 0) {
    return member.mealFrequency
  }
  return workspace.sharedMealFrequency ?? []
}

// Compute the day-of-week for weekStartDate using a local Date construction
// that matches the rest of the engine's timezone assumptions (server-local).
// Returns null for malformed inputs; callers fall back to Monday.
const dayOfWeekFromDate = (weekStartDate: string): DayOfWeek | null => {
  const [y, m, d] = weekStartDate.split('-').map((part) => Number.parseInt(part, 10))
  if (!y || !m || !d) return null
  const date = new Date(y, m - 1, d)
  // Date.getDay(): Sun=0, Mon=1, ..., Sat=6
  const jsDay = date.getDay()
  const idx = jsDay === 0 ? 6 : jsDay - 1
  return DAYS_OF_WEEK[idx] ?? null
}

// Build the ordered list of (dayOfWeek, dayIndexFromStart) tuples the menu
// will cover. dayIndexFromStart is 0-based and used for date offset math;
// dayOfWeek is the enum value used in slot identity. Wrapping around the
// week is allowed: e.g. start = friday, duration = 4 → fri/sat/sun/mon.
export const enumerateMenuDays = ({
  weekStartDate,
  durationDays,
}: {
  weekStartDate: string
  durationDays?: number
}): Array<{ dayOfWeek: DayOfWeek; dayIndex: number }> => {
  const startDay = dayOfWeekFromDate(weekStartDate) ?? 'monday'
  const startIdx = DAY_ORDER[startDay]
  const requested = durationDays ?? DEFAULT_DURATION
  const clamped = Math.max(1, Math.min(MAX_DURATION, Math.floor(requested)))
  const days: Array<{ dayOfWeek: DayOfWeek; dayIndex: number }> = []
  for (let i = 0; i < clamped; i++) {
    const day = DAYS_OF_WEEK[(startIdx + i) % 7]
    if (!day) continue
    days.push({ dayOfWeek: day, dayIndex: i })
  }
  return days
}

// Compute the wall-clock moment a slot starts, interpreted in the server's
// local timezone. dayIndex is the 0-based offset from weekStartDate (not
// DAY_ORDER[dayOfWeek]) so menus starting on Friday still get a continuous
// calendar timeline.
const slotStart = ({
  weekStartDate,
  dayIndex,
  defaultHour,
}: {
  weekStartDate: string
  dayIndex: number
  defaultHour: number
}): number => {
  const [y, m, d] = weekStartDate.split('-').map((part) => Number.parseInt(part, 10))
  if (!y || !m || !d) return Number.POSITIVE_INFINITY
  return new Date(y, m - 1, d + dayIndex, defaultHour, 0, 0, 0).getTime()
}

const isSlotPast = ({
  weekStartDate,
  dayIndex,
  entry,
  nowMs,
}: {
  weekStartDate: string
  dayIndex: number
  entry: MealFrequencyEntry
  nowMs: number
}): boolean => {
  const start = slotStart({
    weekStartDate,
    dayIndex,
    defaultHour: entry.defaultHour,
  })
  return start < nowMs
}

// MVP simplification: every slot is per-member. A future iteration can detect
// when multiple members get the same recipe for the same (day, mealKey) and
// collapse those into a shared slot in the output.
export const buildSlots = ({ input }: { input: GenerateMenuInput }): SlotSpec[] => {
  const nowMs = input.now ? new Date(input.now).getTime() : null
  const days = enumerateMenuDays({
    weekStartDate: input.weekStartDate,
    durationDays: input.durationDays,
  })
  // Pre-compute date offsets keyed by dayOfWeek for the past-filter. When
  // duration wraps around the week (e.g. fri→mon), the same dayOfWeek can
  // appear at most once because durationDays is capped at 7.
  const dayIndexByDay = new Map<DayOfWeek, number>()
  for (const { dayOfWeek, dayIndex } of days) dayIndexByDay.set(dayOfWeek, dayIndex)
  // Materialise the override list as a map once so the inner loop stays O(1).
  const overridesByMember = new Map<string, MealFrequencyEntry[]>()
  for (const override of input.options?.memberFrequencyOverrides ?? []) {
    overridesByMember.set(override.memberId, override.mealFrequency)
  }
  const slots: SlotSpec[] = []
  for (const member of input.members) {
    const frequency = resolveFrequency({
      member,
      workspace: input.workspace,
      overridesByMember,
    })
    for (const { dayOfWeek, dayIndex } of days) {
      for (const entry of frequency) {
        if (
          nowMs !== null &&
          isSlotPast({
            weekStartDate: input.weekStartDate,
            dayIndex,
            entry,
            nowMs,
          })
        ) {
          continue
        }
        slots.push({
          dayOfWeek,
          mealKey: entry.key,
          mealType: entry.mealType,
          targetMemberId: member.id,
        })
      }
    }
  }
  // Sort by the actual dayIndex (calendar order) rather than DAY_ORDER, so a
  // menu starting Friday gets fri/sat/sun, not mon/tue/wed/.../fri/sat/sun.
  slots.sort((a, b) => {
    const ai = dayIndexByDay.get(a.dayOfWeek) ?? 99
    const bi = dayIndexByDay.get(b.dayOfWeek) ?? 99
    if (ai !== bi) return ai - bi
    if (a.mealKey !== b.mealKey) return a.mealKey.localeCompare(b.mealKey)
    return a.targetMemberId.localeCompare(b.targetMemberId)
  })
  return slots
}
