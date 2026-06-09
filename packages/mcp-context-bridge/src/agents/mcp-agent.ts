// MCP-flow agent — uses the structured context + result.
//
// On a red verdict it inspects the context's recipes to find which required
// tags are UNSATISFIABLE (present on no recipe) and removes exactly one per
// step. It never makes a wasted move and never consults the RNG, so its output
// is identical across repeated runs → zero output variance, minimal iterations.

import {
  getRestrictions,
  withRestrictions,
  type RefinementAgent,
  type RefinementInput,
  type RefinementProposal,
} from './types.js'

export const createMcpAgent = (): RefinementAgent => ({
  name: 'mcp-bridge',
  propose({ context }: RefinementInput): RefinementProposal | null {
    const restrictions = getRestrictions(context)
    // Structured feedback: a required tag is unsatisfiable when no recipe in the
    // context carries it. This is the read-back the protocol makes cheap.
    const availableTags = new Set(context.payload.recipes.flatMap((r) => r.dietaryTags))
    const offenders = restrictions.filter((t) => !availableTags.has(t)).sort()
    if (offenders.length === 0) return null

    const drop = offenders[0] as string
    const next = restrictions.filter((t) => t !== drop)
    return {
      rationale: `Structured analysis: required tag "${drop}" is on 0 of ${context.payload.recipes.length} recipes — removing the one offender.`,
      nextContext: withRestrictions(context, next),
      diff: {
        field: 'options.additionalDietaryRestrictions',
        op: 'remove',
        from: restrictions,
        to: next,
        note: `drop unsatisfiable required tag "${drop}"`,
      },
    }
  },
})
