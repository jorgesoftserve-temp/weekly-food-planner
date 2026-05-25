import { describe, expect, it } from 'vitest'
import { canonicalJson } from '../canonical.js'

describe('canonicalJson', () => {
  it('produces identical output regardless of key order', () => {
    const a = canonicalJson({ value: { b: 1, a: 2 } })
    const b = canonicalJson({ value: { a: 2, b: 1 } })
    expect(a).toBe(b)
  })

  it('sorts nested object keys recursively', () => {
    const json = canonicalJson({
      value: { outer: { z: 1, a: { y: 2, b: 3 } } },
    })
    expect(json).toBe('{"outer":{"a":{"b":3,"y":2},"z":1}}')
  })

  it('preserves array order', () => {
    const json = canonicalJson({ value: [3, 1, 2] })
    expect(json).toBe('[3,1,2]')
  })

  it('handles primitives, null, and nested arrays of objects', () => {
    const json = canonicalJson({
      value: [{ b: 'two', a: 'one' }, null, 42, true],
    })
    expect(json).toBe('[{"a":"one","b":"two"},null,42,true]')
  })
})
