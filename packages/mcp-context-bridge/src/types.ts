// Protocol message + envelope + state types for the MCP context bridge.
//
// The bridge exposes five verbs — sendContext, requestAction, receiveResult,
// confirm, rollback — over a deterministic menu-generation action. Everything
// crossing the verb boundary is JSON-round-trippable (mirrors the engine's
// boundary contract) so the context can be serialised, hashed, logged, and
// replayed.

import type {
  GenerateMenuInput,
  GenerateMenuResult,
} from '@weekly-food-planner/constraint-engine'

// The session walks: idle → context_set → result_ready → confirmed.
// rollback returns result_ready/confirmed back to context_set (or idle).
export type SessionState = 'idle' | 'context_set' | 'result_ready' | 'confirmed'

// The unit of context sent over the wire. `payload` is the full engine input;
// `intent` is the human-readable goal; `meta` is provenance for the log.
export type ContextEnvelope = {
  kind: 'menu-generation'
  intent: string
  payload: GenerateMenuInput
  meta: { createdBy: string; note?: string }
}

// The verify verdict produced after every generation. `green` is the
// pass/fail signal the verify→refine loop turns on.
export type VerifyVerdict = {
  green: boolean
  totalSlots: number
  filledSlots: number
  unfilledSlots: number
  failures: string[]
}

// ── Verb argument + result shapes ───────────────────────────────────────────

export type SendContextArgs = { context: ContextEnvelope }
export type SendContextResult = {
  contextRef: string
  contextHash: string
  state: SessionState
}

export type ActionKind = 'generate_menu'
export type RequestActionArgs = {
  contextRef: string
  action: ActionKind
  seedOverride?: number
}
export type RequestActionResult = {
  actionRef: string
  contextRef: string
  state: SessionState
}

export type ReceiveResultArgs = { actionRef: string }
export type ReceiveResultResult = {
  actionRef: string
  contextRef: string
  result: GenerateMenuResult
  verify: VerifyVerdict
  state: SessionState
}

export type ConfirmArgs = { actionRef: string }
export type ConfirmResult = {
  acceptedRef: string
  actionRef: string
  // sha256(inputsHash + sorted slot recipe-tuples) — mirrors the product's
  // accepted_seed (apps/web/lib/api/menu-accept.ts). Stable per accepted menu.
  acceptedSeed: string
  state: SessionState
}

export type RollbackArgs = { reason?: string }
export type RollbackResult = {
  state: SessionState
  restoredContextRef: string | null
  discardedActionRef: string | null
  reason: string | null
}

// A structural description of one refinement the agent applied to the context.
// Recorded verbatim in the agent_iteration_log under "diffs applied".
export type ContextDiff = {
  field: string
  op: 'remove' | 'add' | 'bump' | 'noop'
  from: unknown
  to: unknown
  note: string
}
