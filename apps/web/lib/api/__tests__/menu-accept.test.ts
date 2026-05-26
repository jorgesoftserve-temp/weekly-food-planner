import { describe, expect, it } from 'vitest'
import { __test__ } from '../menu-accept'

const { computeAcceptedSeed } = __test__

describe('computeAcceptedSeed', () => {
  const baseSlots = [
    {
      day_of_week: 'monday',
      meal_key: 'breakfast',
      target_member_id: 'm1',
      recipe_id: 'r-pancakes',
    },
    {
      day_of_week: 'monday',
      meal_key: 'dinner',
      target_member_id: 'm1',
      recipe_id: 'r-stew',
    },
    {
      day_of_week: 'tuesday',
      meal_key: 'breakfast',
      target_member_id: null,
      recipe_id: 'r-oats',
    },
  ]

  it('produces a stable hash for the same inputs', () => {
    const a = computeAcceptedSeed({ inputsHash: 'h1', slots: baseSlots })
    const b = computeAcceptedSeed({ inputsHash: 'h1', slots: baseSlots })
    expect(a).toBe(b)
    expect(a).toHaveLength(64) // sha256 hex
  })

  it('is independent of slot order', () => {
    const shuffled = [baseSlots[2]!, baseSlots[0]!, baseSlots[1]!]
    const a = computeAcceptedSeed({ inputsHash: 'h1', slots: baseSlots })
    const b = computeAcceptedSeed({ inputsHash: 'h1', slots: shuffled })
    expect(a).toBe(b)
  })

  it('changes when any slot recipe changes', () => {
    const pristine = computeAcceptedSeed({
      inputsHash: 'h1',
      slots: baseSlots,
    })
    const modifiedSlots = baseSlots.map((s, idx) =>
      idx === 0 ? { ...s, recipe_id: 'r-omelette' } : s,
    )
    const modified = computeAcceptedSeed({
      inputsHash: 'h1',
      slots: modifiedSlots,
    })
    expect(modified).not.toBe(pristine)
  })

  it('changes when the inputs_hash changes', () => {
    const a = computeAcceptedSeed({ inputsHash: 'h1', slots: baseSlots })
    const b = computeAcceptedSeed({ inputsHash: 'h2', slots: baseSlots })
    expect(a).not.toBe(b)
  })

  it('distinguishes per-member vs shared slots', () => {
    const sharedSlot = {
      ...baseSlots[0]!,
      target_member_id: null,
    }
    const memberSlot = {
      ...baseSlots[0]!,
      target_member_id: 'm1',
    }
    const a = computeAcceptedSeed({
      inputsHash: 'h1',
      slots: [sharedSlot, baseSlots[1]!, baseSlots[2]!],
    })
    const b = computeAcceptedSeed({
      inputsHash: 'h1',
      slots: [memberSlot, baseSlots[1]!, baseSlots[2]!],
    })
    expect(a).not.toBe(b)
  })
})
