import { describe, expect, it } from 'vitest'
import { sha256OfInput } from '../hash.js'

describe('sha256OfInput', () => {
  it('produces a 64-char hex digest', async () => {
    const hex = await sha256OfInput({ value: { a: 1, b: 2 } })
    expect(hex).toMatch(/^[0-9a-f]{64}$/)
  })

  it('produces identical hashes for equivalent inputs (key order ignored)', async () => {
    const a = await sha256OfInput({ value: { x: 1, y: { b: 2, a: 1 } } })
    const b = await sha256OfInput({ value: { y: { a: 1, b: 2 }, x: 1 } })
    expect(a).toBe(b)
  })

  it('produces different hashes for different inputs', async () => {
    const a = await sha256OfInput({ value: { x: 1 } })
    const b = await sha256OfInput({ value: { x: 2 } })
    expect(a).not.toBe(b)
  })
})
