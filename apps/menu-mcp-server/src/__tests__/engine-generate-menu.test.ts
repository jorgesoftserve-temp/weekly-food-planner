import { describe, expect, it } from 'vitest'
import { makeGenerateMenuInput } from '@weekly-food-planner/constraint-engine/test-utils'
import { engineGenerateMenuHandler } from '../tools/engine-generate-menu.js'

const parseFirstText = (result: { content: Array<{ type: 'text'; text: string }> }) => {
  const block = result.content[0]
  if (block === undefined) throw new Error('expected at least one content block')
  return JSON.parse(block.text) as unknown
}

describe('engineGenerateMenuHandler', () => {
  it('runs the engine and returns the result inside a text content block', async () => {
    const input = makeGenerateMenuInput()
    const result = await engineGenerateMenuHandler({ input })
    expect(result.content).toHaveLength(1)
    expect(result.content[0]?.type).toBe('text')
    const parsed = parseFirstText(result) as { ok: boolean }
    expect(typeof parsed.ok).toBe('boolean')
  })

  it('is deterministic for the same input and seed', async () => {
    const input = makeGenerateMenuInput({ seed: 1234 })
    const a = parseFirstText(await engineGenerateMenuHandler({ input }))
    const b = parseFirstText(await engineGenerateMenuHandler({ input }))
    expect(a).toEqual(b)
  })

  it('uses the top-level seed override when provided', async () => {
    const input = makeGenerateMenuInput({ seed: 1 })
    const a = parseFirstText(await engineGenerateMenuHandler({ input, seed: 999 }))
    const b = parseFirstText(await engineGenerateMenuHandler({ input: { ...input, seed: 999 } }))
    expect(a).toEqual(b)
  })

  it('different seeds usually produce different menus (smoke test for randomness)', async () => {
    const input = makeGenerateMenuInput()
    const a = JSON.stringify(parseFirstText(await engineGenerateMenuHandler({ input, seed: 1 })))
    const b = JSON.stringify(parseFirstText(await engineGenerateMenuHandler({ input, seed: 2 })))
    // Not a strict requirement of the engine but a sanity check that the
    // override actually reaches the engine. If this ever flakes, drop it.
    expect(a === b).toBe(false)
  })
})
