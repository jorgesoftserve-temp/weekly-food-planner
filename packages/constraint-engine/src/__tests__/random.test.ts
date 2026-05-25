import { describe, expect, it } from 'vitest'
import { createRng } from '../random.js'

describe('createRng', () => {
  it('produces a deterministic sequence for the same seed', () => {
    const rngA = createRng({ seed: 42 })
    const rngB = createRng({ seed: 42 })
    const sequenceA = Array.from({ length: 10 }, () => rngA.next())
    const sequenceB = Array.from({ length: 10 }, () => rngB.next())
    expect(sequenceA).toEqual(sequenceB)
  })

  it('produces different sequences for different seeds', () => {
    const rngA = createRng({ seed: 1 })
    const rngB = createRng({ seed: 2 })
    const sequenceA = Array.from({ length: 10 }, () => rngA.next())
    const sequenceB = Array.from({ length: 10 }, () => rngB.next())
    expect(sequenceA).not.toEqual(sequenceB)
  })

  it('returns next() values in the [0, 1) range', () => {
    const rng = createRng({ seed: 12345 })
    for (let i = 0; i < 100; i++) {
      const value = rng.next()
      expect(value).toBeGreaterThanOrEqual(0)
      expect(value).toBeLessThan(1)
    }
  })

  it('returns nextInt(max) values in the [0, max) integer range', () => {
    const rng = createRng({ seed: 99 })
    for (let i = 0; i < 100; i++) {
      const value = rng.nextInt(10)
      expect(Number.isInteger(value)).toBe(true)
      expect(value).toBeGreaterThanOrEqual(0)
      expect(value).toBeLessThan(10)
    }
  })
})
