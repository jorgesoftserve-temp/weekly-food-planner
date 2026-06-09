// The refinement-agent contract shared by both flows.
//
// A RefinementAgent looks at the current context and the last (failed) result
// and proposes the next context, or null to give up. The two implementations
// differ only in HOW they decide:
//   - naive-agent  (Module-1 baseline): blind, RNG-driven, ignores the
//     structured result — wanders.
//   - mcp-agent    (MCP flow): reads the structured context/result and makes a
//     surgical, deterministic fix — converges.

import type { GenerateMenuResult, Rng } from '@weekly-food-planner/constraint-engine'
import type { ContextDiff, ContextEnvelope, VerifyVerdict } from '../types.js'

export type RefinementInput = {
  context: ContextEnvelope
  lastResult: GenerateMenuResult
  lastVerdict: VerifyVerdict
  rng: Rng
  iteration: number
}

export type RefinementProposal = {
  rationale: string
  nextContext: ContextEnvelope
  diff: ContextDiff
}

export interface RefinementAgent {
  readonly name: string
  propose(input: RefinementInput): RefinementProposal | null
}

// Shared helpers for reading/writing the tunable surface of a context.
export const getRestrictions = (c: ContextEnvelope): string[] =>
  c.payload.options?.additionalDietaryRestrictions ?? []

export const withRestrictions = (
  c: ContextEnvelope,
  next: string[],
): ContextEnvelope => ({
  ...c,
  payload: {
    ...c.payload,
    options: { ...(c.payload.options ?? {}), additionalDietaryRestrictions: next },
  },
})

export const withSeed = (c: ContextEnvelope, seed: number): ContextEnvelope => ({
  ...c,
  payload: { ...c.payload, seed },
})

export const withPreferredCuisines = (
  c: ContextEnvelope,
  next: string[],
): ContextEnvelope => ({
  ...c,
  payload: {
    ...c.payload,
    options: { ...(c.payload.options ?? {}), preferredCuisines: next },
  },
})
