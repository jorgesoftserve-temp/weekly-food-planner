import { describe, expect, it } from 'vitest'
import { makeGenerateMenuInput, makeMember } from '../test-utils/index.js'
import { buildSlots } from '../slots.js'

// The frequency cascade is: override → member.mealFrequency → workspace.shared.
// Each test isolates one step of that ladder by setting the higher-priority
// source and asserting the engine ignores the lower-priority ones.

describe('buildSlots / memberFrequencyOverrides', () => {
  it('uses the override when one exists for the member', () => {
    const alice = makeMember({
      id: 'alice',
      mealFrequency: [
        { key: 'breakfast', title: 'Breakfast', mealType: 'breakfast', defaultHour: 7 },
        { key: 'lunch', title: 'Lunch', mealType: 'lunch', defaultHour: 12 },
      ],
    })
    const slots = buildSlots({
      input: makeGenerateMenuInput({
        members: [alice],
        recipes: [],
        options: {
          memberFrequencyOverrides: [
            {
              memberId: 'alice',
              mealFrequency: [
                { key: 'dinner', title: 'Dinner', mealType: 'dinner', defaultHour: 19 },
              ],
            },
          ],
        },
      }),
    })
    // 7 days × 1 override entry × 1 member = 7. Crucially, only `dinner`
    // appears — the member's own 2-entry frequency is ignored.
    expect(slots).toHaveLength(7)
    expect(slots.every((s) => s.mealKey === 'dinner')).toBe(true)
  })

  it('honours an empty override as "no slots for this member"', () => {
    const alice = makeMember({
      id: 'alice',
      mealFrequency: [
        { key: 'breakfast', title: 'Breakfast', mealType: 'breakfast', defaultHour: 7 },
      ],
    })
    const slots = buildSlots({
      input: makeGenerateMenuInput({
        members: [alice],
        recipes: [],
        options: {
          memberFrequencyOverrides: [
            { memberId: 'alice', mealFrequency: [] },
          ],
        },
      }),
    })
    expect(slots).toHaveLength(0)
  })

  it('leaves non-overridden members on their own frequency cascade', () => {
    const alice = makeMember({
      id: 'alice',
      mealFrequency: [
        { key: 'breakfast', title: 'Breakfast', mealType: 'breakfast', defaultHour: 7 },
      ],
    })
    const bob = makeMember({
      id: 'bob',
      mealFrequency: [
        { key: 'lunch', title: 'Lunch', mealType: 'lunch', defaultHour: 12 },
      ],
    })
    const slots = buildSlots({
      input: makeGenerateMenuInput({
        members: [alice, bob],
        recipes: [],
        options: {
          memberFrequencyOverrides: [
            {
              memberId: 'alice',
              mealFrequency: [
                { key: 'dinner', title: 'Dinner', mealType: 'dinner', defaultHour: 19 },
              ],
            },
          ],
        },
      }),
    })
    // Alice has override → dinner only. Bob unchanged → lunch only.
    const aliceSlots = slots.filter((s) => s.targetMemberId === 'alice')
    const bobSlots = slots.filter((s) => s.targetMemberId === 'bob')
    expect(aliceSlots.every((s) => s.mealKey === 'dinner')).toBe(true)
    expect(bobSlots.every((s) => s.mealKey === 'lunch')).toBe(true)
    expect(aliceSlots.length).toBe(7)
    expect(bobSlots.length).toBe(7)
  })

  it('ignores overrides whose memberId is not in input.members', () => {
    const alice = makeMember({
      id: 'alice',
      mealFrequency: [
        { key: 'breakfast', title: 'Breakfast', mealType: 'breakfast', defaultHour: 7 },
      ],
    })
    const slots = buildSlots({
      input: makeGenerateMenuInput({
        members: [alice],
        recipes: [],
        options: {
          memberFrequencyOverrides: [
            {
              memberId: 'someone-else',
              mealFrequency: [
                { key: 'dinner', title: 'Dinner', mealType: 'dinner', defaultHour: 19 },
              ],
            },
          ],
        },
      }),
    })
    // Alice's own frequency wins because the bogus override never matches her id.
    expect(slots.every((s) => s.mealKey === 'breakfast')).toBe(true)
  })
})
