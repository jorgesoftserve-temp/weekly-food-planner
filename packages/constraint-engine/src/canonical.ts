// Canonical JSON: stable key ordering so equivalent inputs hash identically.
// Arrays preserve order; object keys are sorted recursively.

const sortObject = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(sortObject)
  if (value === null || typeof value !== 'object') return value
  const entries = value as Record<string, unknown>
  const sorted: Record<string, unknown> = {}
  for (const key of Object.keys(entries).sort()) {
    sorted[key] = sortObject(entries[key])
  }
  return sorted
}

export const canonicalJson = ({ value }: { value: unknown }): string => {
  return JSON.stringify(sortObject(value))
}
