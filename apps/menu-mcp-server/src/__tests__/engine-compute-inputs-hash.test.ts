import { describe, expect, it } from 'vitest'
import { makeGenerateMenuInput } from '@weekly-food-planner/constraint-engine/test-utils'
import { sha256OfInput } from '@weekly-food-planner/constraint-engine'
import { engineComputeInputsHashHandler } from '../tools/engine-compute-inputs-hash.js'

const parseHash = (result: { content: Array<{ type: 'text'; text: string }> }) => {
  const block = result.content[0]
  if (block === undefined) throw new Error('expected at least one content block')
  return (JSON.parse(block.text) as { inputsHash: string }).inputsHash
}

describe('engineComputeInputsHashHandler', () => {
  it('returns a sha256 hex string matching the engine\'s sha256OfInput', async () => {
    const input = makeGenerateMenuInput({ seed: 42 })
    const result = await engineComputeInputsHashHandler({ input })
    const hash = parseHash(result)
    const direct = await sha256OfInput({ value: input })
    expect(hash).toBe(direct)
    expect(hash).toMatch(/^[a-f0-9]{64}$/)
  })

  it('produces the same hash for canonically-equal inputs', async () => {
    const a = makeGenerateMenuInput({ seed: 7 })
    const b = makeGenerateMenuInput({ seed: 7 })
    const ha = parseHash(await engineComputeInputsHashHandler({ input: a }))
    const hb = parseHash(await engineComputeInputsHashHandler({ input: b }))
    expect(ha).toBe(hb)
  })

  it('produces different hashes when the seed differs', async () => {
    const ha = parseHash(
      await engineComputeInputsHashHandler({ input: makeGenerateMenuInput({ seed: 1 }) }),
    )
    const hb = parseHash(
      await engineComputeInputsHashHandler({ input: makeGenerateMenuInput({ seed: 2 }) }),
    )
    expect(ha).not.toBe(hb)
  })
})
