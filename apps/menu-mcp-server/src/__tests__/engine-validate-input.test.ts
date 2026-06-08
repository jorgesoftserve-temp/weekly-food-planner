import { describe, expect, it } from 'vitest'
import {
  makeGenerateMenuInput,
  makeMember,
  makeRecipe,
  makeWorkspace,
} from '@weekly-food-planner/constraint-engine/test-utils'
import { engineValidateInputHandler } from '../tools/engine-validate-input.js'

type ValidateResult = {
  ok: boolean
  slotCount: number
  slotsIgnoringNowCount: number
  memberCount: number
  recipeCount: number
  ingredientCount: number
  issues: string[]
}

const parseValidate = (result: {
  content: Array<{ type: 'text'; text: string }>
}): ValidateResult => {
  const block = result.content[0]
  if (block === undefined) throw new Error('expected at least one content block')
  return JSON.parse(block.text) as ValidateResult
}

describe('engineValidateInputHandler', () => {
  it('reports ok:true and a positive slotCount for a well-formed input', async () => {
    const input = makeGenerateMenuInput()
    const parsed = parseValidate(await engineValidateInputHandler({ input }))
    expect(parsed.ok).toBe(true)
    expect(parsed.slotCount).toBeGreaterThan(0)
    expect(parsed.issues).toEqual([])
  })

  it('flags an empty members[] as an issue', async () => {
    const input = makeGenerateMenuInput({ members: [] })
    const parsed = parseValidate(await engineValidateInputHandler({ input }))
    expect(parsed.ok).toBe(false)
    expect(parsed.memberCount).toBe(0)
    expect(parsed.issues.some((m) => m.includes('members[] is empty'))).toBe(true)
  })

  it('flags an empty recipes[] as an issue', async () => {
    const input = makeGenerateMenuInput({ recipes: [] })
    const parsed = parseValidate(await engineValidateInputHandler({ input }))
    expect(parsed.ok).toBe(false)
    expect(parsed.recipeCount).toBe(0)
    expect(parsed.issues.some((m) => m.includes('recipes[] is empty'))).toBe(true)
  })

  it('reports zero slots and "no frequency" when nobody has a meal_frequency', async () => {
    // Empty arrays at both layers — the factory's default would otherwise
    // populate a workspace-level frequency and mask the issue.
    const input = makeGenerateMenuInput({
      workspace: makeWorkspace({ sharedMealFrequency: [] }),
      members: [makeMember({ mealFrequency: [] })],
      recipes: [makeRecipe({ id: 'r1', mealType: 'dinner' })],
    })
    const parsed = parseValidate(await engineValidateInputHandler({ input }))
    expect(parsed.ok).toBe(false)
    expect(parsed.slotCount).toBe(0)
    expect(parsed.issues.some((m) => m.includes('meal_frequency'))).toBe(true)
  })

  it('distinguishes "every meal in the past" from "no frequency" via the now-filter probe', async () => {
    // weekStartDate in the past + now far in the future → every slot filtered.
    const input = makeGenerateMenuInput({
      weekStartDate: '2020-01-06',
      now: '2026-12-31T00:00:00.000Z',
    })
    const parsed = parseValidate(await engineValidateInputHandler({ input }))
    expect(parsed.ok).toBe(false)
    expect(parsed.slotCount).toBe(0)
    expect(parsed.slotsIgnoringNowCount).toBeGreaterThan(0)
    expect(
      parsed.issues.some((m) => m.includes('already in the past')),
    ).toBe(true)
  })

  it('returns accurate counts alongside the verdict', async () => {
    const input = makeGenerateMenuInput()
    const parsed = parseValidate(await engineValidateInputHandler({ input }))
    expect(parsed.memberCount).toBe(input.members.length)
    expect(parsed.recipeCount).toBe(input.recipes.length)
    expect(parsed.ingredientCount).toBe(input.ingredients.length)
  })
})
