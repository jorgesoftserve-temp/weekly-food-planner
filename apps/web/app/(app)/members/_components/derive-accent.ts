import type { AccentColor } from '@weekly-food-planner/supabase'

// Deterministic accent fallback — hashes a member id (UUID string) to one of
// the six accent keys. No randomness, no AI: the same id always returns the
// same accent, matching the migration's "derive from id at render time" intent.
// Used only when member.accent_color is NULL.

const ACCENT_KEYS: AccentColor[] = [
  'strawberry',
  'moss',
  'teal',
  'amber',
  'ocean',
  'plum',
]

// FNV-1a 32-bit hash over the string, then mod to the palette length.
// Fast, stable, no crypto dependency, good distribution over UUIDs.
const fnv1a32 = (str: string): number => {
  let hash = 0x811c9dc5
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i)
    // Simulate 32-bit overflow with unsigned right-shift.
    hash = (Math.imul(hash, 0x01000193) >>> 0)
  }
  return hash
}

export const deriveAccentFromId = (id: string): AccentColor =>
  ACCENT_KEYS[fnv1a32(id) % ACCENT_KEYS.length]!
