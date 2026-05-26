import { describe, expect, it } from 'vitest'
import { makeMember } from '@weekly-food-planner/test-utils'
import { computeEffectiveOverlay } from '../menu-overlay'

describe('computeEffectiveOverlay', () => {
  it('returns undefined when raw is undefined', () => {
    expect(computeEffectiveOverlay({ raw: undefined, members: [] })).toBeUndefined()
  })

  it('drops dietary restrictions already on any member profile', () => {
    const alice = makeMember({ id: 'm1', dietaryRestrictions: ['vegan'] })
    const bob = makeMember({ id: 'm2', dietaryRestrictions: ['vegetarian'] })
    const result = computeEffectiveOverlay({
      raw: { additionalDietaryRestrictions: ['vegan', 'gluten_free'] },
      members: [alice, bob],
    })
    expect(result?.additionalDietaryRestrictions).toEqual(['gluten_free'])
  })

  it('drops allergies already on any member profile', () => {
    const alice = makeMember({ id: 'm1', allergies: ['peanut'] })
    const result = computeEffectiveOverlay({
      raw: { additionalAllergies: ['peanut', 'tree_nut'] },
      members: [alice],
    })
    expect(result?.additionalAllergies).toEqual(['tree_nut'])
  })

  it('passes through ingredientExclusions unfiltered (no member equivalent)', () => {
    const alice = makeMember({ ingredientDislikes: ['ing-1'] })
    const result = computeEffectiveOverlay({
      raw: { ingredientExclusions: ['ing-1', 'ing-2'] },
      members: [alice],
    })
    expect(result?.ingredientExclusions).toEqual(['ing-1', 'ing-2'])
  })

  it('returns undefined when every overlay field filters out to empty', () => {
    const alice = makeMember({ dietaryRestrictions: ['vegan'], allergies: ['peanut'] })
    const result = computeEffectiveOverlay({
      raw: {
        additionalDietaryRestrictions: ['vegan'],
        additionalAllergies: ['peanut'],
      },
      members: [alice],
    })
    expect(result).toBeUndefined()
  })

  it('preserves scalar fields even with no list overrides', () => {
    const result = computeEffectiveOverlay({
      raw: { calorieTolerance: 0.1, repetitionLimit: 2 },
      members: [],
    })
    expect(result).toEqual({ calorieTolerance: 0.1, repetitionLimit: 2 })
  })

  it('omits preferredCuisines when the array is empty', () => {
    const result = computeEffectiveOverlay({
      raw: { preferredCuisines: [] },
      members: [],
    })
    expect(result).toBeUndefined()
  })

  it('keeps memberFrequencyOverrides whose memberId is a participant', () => {
    const alice = makeMember({ id: 'alice' })
    const result = computeEffectiveOverlay({
      raw: {
        memberFrequencyOverrides: [
          {
            memberId: 'alice',
            mealFrequency: [
              { key: 'lunch', title: 'Lunch', mealType: 'lunch', defaultHour: 12 },
            ],
          },
        ],
      },
      members: [alice],
    })
    expect(result?.memberFrequencyOverrides).toEqual([
      {
        memberId: 'alice',
        mealFrequency: [
          { key: 'lunch', title: 'Lunch', mealType: 'lunch', defaultHour: 12 },
        ],
      },
    ])
  })

  it('drops memberFrequencyOverrides whose memberId is not a participant', () => {
    const alice = makeMember({ id: 'alice' })
    const result = computeEffectiveOverlay({
      raw: {
        memberFrequencyOverrides: [
          {
            memberId: 'bob',
            mealFrequency: [
              { key: 'lunch', title: 'Lunch', mealType: 'lunch', defaultHour: 12 },
            ],
          },
        ],
      },
      members: [alice],
    })
    expect(result).toBeUndefined()
  })
})
