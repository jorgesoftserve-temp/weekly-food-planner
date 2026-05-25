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
})
