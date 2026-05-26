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
