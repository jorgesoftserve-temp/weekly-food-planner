import { describe, expect, it } from 'vitest'
import { canonicalJson, contextEnvelopeSchema, hashContext, roundTrip } from '../schema.js'
import { makeFeasibleContext, makeInfeasibleContext } from '../scenario.js'

// Deterministic unit tests: serialized context shapes + round-trip integrity.
describe('context schema + canonical serialisation', () => {
  it('validates a well-formed context envelope', () => {
    expect(contextEnvelopeSchema.safeParse(makeFeasibleContext()).success).toBe(true)
    expect(contextEnvelopeSchema.safeParse(makeInfeasibleContext()).success).toBe(true)
  })

  it('rejects an envelope with an empty intent', () => {
    const bad = { ...makeFeasibleContext(), intent: '' }
    expect(contextEnvelopeSchema.safeParse(bad).success).toBe(false)
  })

  it('rejects an envelope with the wrong kind', () => {
    const bad = { ...makeFeasibleContext(), kind: 'something-else' }
    expect(contextEnvelopeSchema.safeParse(bad).success).toBe(false)
  })

  it('round-trips losslessly through JSON.stringify/parse', () => {
    const ctx = makeInfeasibleContext()
    expect(roundTrip(ctx)).toEqual(ctx)
  })

  it('canonicalJson sorts object keys deterministically (order-independent)', () => {
    expect(canonicalJson({ b: 1, a: 2 })).toBe('{"a":2,"b":1}')
    expect(canonicalJson({ b: 1, a: 2 })).toBe(canonicalJson({ a: 2, b: 1 }))
  })

  it('hashContext is stable across key ordering and after a round-trip', () => {
    const ctx = makeInfeasibleContext()
    expect(hashContext(ctx)).toMatch(/^[0-9a-f]{64}$/)
    expect(hashContext(ctx)).toBe(hashContext(roundTrip(ctx)))
  })

  it('distinct contexts produce distinct content hashes', () => {
    expect(hashContext(makeFeasibleContext())).not.toBe(hashContext(makeInfeasibleContext()))
  })
})
