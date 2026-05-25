// SHA-256 over the canonical JSON of an input value. Used to compute
// `inputs_hash` on every menu / generation_run for determinism audit.
// Async because SubtleCrypto.digest is async; this is a pure deterministic
// function despite being async (no clock, no randomness).

import { canonicalJson } from './canonical.js'

const HEX_CHARS = '0123456789abcdef'

const bytesToHex = ({ bytes }: { bytes: Uint8Array }): string => {
  let out = ''
  for (const byte of bytes) {
    out += HEX_CHARS[(byte >> 4) & 0xf]
    out += HEX_CHARS[byte & 0xf]
  }
  return out
}

export const sha256OfInput = async ({ value }: { value: unknown }): Promise<string> => {
  const encoded = new TextEncoder().encode(canonicalJson({ value }))
  const digest = await crypto.subtle.digest('SHA-256', encoded)
  return bytesToHex({ bytes: new Uint8Array(digest) })
}
