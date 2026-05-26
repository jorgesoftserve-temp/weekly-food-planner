import { describe, expect, it } from 'vitest'
import { makeGenerateMenuInput, makeMember } from '../test-utils/index.js'
import { buildSlots } from '../slots.js'

const baseInput = makeGenerateMenuInput({ recipes: [], members: [makeMember()] })

describe('buildSlots', () => {
  it('produces 7 days × frequency entries × members', () => {
    const slots = buildSlots({ input: baseInput })
    expect(slots).toHaveLength(14)
  })

  it('uses member meal_frequency over workspace shared frequency', () => {
    const slots = buildSlots({
      input: {
        ...baseInput,
        members: [
          makeMember({
            mealFrequency: [
              { key: 'lunch', title: 'Lunch', mealType: 'lunch', defaultHour: 12 },
            ],
          }),
        ],
      },
    })
    expect(slots).toHaveLength(7)
    expect(slots.every((slot) => slot.mealKey === 'lunch')).toBe(true)
  })

  it('returns slots in deterministic day-first then mealKey-alphabetical order', () => {
    const slots = buildSlots({ input: baseInput })
    const first = slots[0]
    const second = slots[1]
    if (!first || !second) throw new Error('Expected at least two slots')
    expect(first.dayOfWeek).toBe('monday')
    expect(first.mealKey).toBe('breakfast')
    expect(second.mealKey).toBe('dinner')
  })

  it('returns empty when no frequency is defined anywhere', () => {
    const slots = buildSlots({
      input: {
        ...baseInput,
        workspace: { ...baseInput.workspace, sharedMealFrequency: undefined },
      },
    })
    expect(slots).toHaveLength(0)
  })

  describe('with durationDays + non-Monday start', () => {
    it('honours durationDays for variable-length menus', () => {
      const slots = buildSlots({
        input: { ...baseInput, durationDays: 3 },
      })
      // 3 days × 2 meals × 1 member = 6
      expect(slots).toHaveLength(6)
      const uniqueDays = new Set(slots.map((s) => s.dayOfWeek))
      expect(uniqueDays.size).toBe(3)
    })

    it('starts on the day implied by weekStartDate', () => {
      // 2026-06-05 is a Friday.
      const slots = buildSlots({
        input: {
          ...baseInput,
          weekStartDate: '2026-06-05',
          durationDays: 3,
        },
      })
      const days = Array.from(new Set(slots.map((s) => s.dayOfWeek)))
      expect(days).toEqual(['friday', 'saturday', 'sunday'])
    })

    it('wraps across the Sunday boundary when duration extends past week end', () => {
      // 2026-06-05 = Friday. Duration 4 → fri/sat/sun/mon.
      const slots = buildSlots({
        input: {
          ...baseInput,
          weekStartDate: '2026-06-05',
          durationDays: 4,
        },
      })
      const days = Array.from(new Set(slots.map((s) => s.dayOfWeek)))
      expect(days).toEqual(['friday', 'saturday', 'sunday', 'monday'])
    })

    it('clamps durationDays to [1, 7]', () => {
      const tooMany = buildSlots({
        input: { ...baseInput, durationDays: 99 },
      })
      const tooFew = buildSlots({
        input: { ...baseInput, durationDays: 0 },
      })
      // Default frequency is 2 meals/day, 1 member.
      expect(tooMany).toHaveLength(14) // capped at 7 days
      expect(tooFew).toHaveLength(2) // floored to 1 day
    })
  })

  describe('with `now` set (ongoing-week filtering)', () => {
    // baseInput.weekStartDate = '2026-06-01' (Monday). Default frequency =
    // breakfast (defaultHour 8) + dinner (defaultHour 18).
    it('keeps all 14 slots when now is before the weekStartDate', () => {
      const slots = buildSlots({
        input: { ...baseInput, now: '2026-05-25T12:00:00' },
      })
      expect(slots).toHaveLength(14)
    })

    it('drops slots whose (day, defaultHour) is before now', () => {
      // Wed Jun 3 at noon: Mon (2) + Tue (2) + Wed breakfast (1) = 5 past.
      const slots = buildSlots({
        input: { ...baseInput, now: '2026-06-03T12:00:00' },
      })
      expect(slots).toHaveLength(9)
      // Wed dinner is the first surviving slot
      const first = slots[0]
      expect(first?.dayOfWeek).toBe('wednesday')
      expect(first?.mealKey).toBe('dinner')
    })

    it('returns zero slots when now is after the entire week', () => {
      const slots = buildSlots({
        input: { ...baseInput, now: '2026-06-15T00:00:00' },
      })
      expect(slots).toHaveLength(0)
    })
  })
})
