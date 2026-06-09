// The protocol state machine behind the five verbs.
//
// A ProtocolSession owns one menu-generation conversation: contexts are pushed
// with sendContext, an action runs the deterministic engine, results are read
// back, then either confirmed (accept) or rolled back (discard). Refs are
// deterministic counters (no Date.now / Math.random) so logs and tests are
// byte-stable.

import { generateMenu } from '@weekly-food-planner/constraint-engine'
import type {
  GenerateMenuInput,
  GenerateMenuResult,
} from '@weekly-food-planner/constraint-engine'
import { canonicalJson, hashContext, roundTrip, sha256Hex } from './schema.js'
import { verifyResult } from './verify.js'
import type {
  ConfirmArgs,
  ConfirmResult,
  ContextEnvelope,
  ReceiveResultArgs,
  ReceiveResultResult,
  RequestActionArgs,
  RequestActionResult,
  RollbackArgs,
  RollbackResult,
  SendContextArgs,
  SendContextResult,
  SessionState,
  VerifyVerdict,
} from './types.js'

export class ProtocolError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message)
    this.name = 'ProtocolError'
  }
}

type StoredContext = { ref: string; envelope: ContextEnvelope; hash: string }
type StoredAction = {
  actionRef: string
  contextRef: string
  result: GenerateMenuResult
  verify: VerifyVerdict
}

// sha256(inputsHash + canonical(sorted slot recipe-tuples)) — mirrors
// apps/web/lib/api/menu-accept.ts so the bridge's "accept" is faithful.
const computeAcceptedSeed = (
  result: Extract<GenerateMenuResult, { ok: true }>,
): string => {
  const tuples = result.menu.slots
    .map((s) => `${s.dayOfWeek}|${s.mealKey}|${s.targetMemberId ?? ''}|${s.recipeId}`)
    .sort()
  return sha256Hex(result.inputsHash + canonicalJson(tuples))
}

export class ProtocolSession {
  private counter = 0
  private state: SessionState = 'idle'
  private readonly contextHistory: StoredContext[] = []
  private readonly actions = new Map<string, StoredAction>()
  private currentContextRef: string | null = null
  private currentActionRef: string | null = null
  private confirmed: ConfirmResult | null = null

  private nextRef(prefix: string): string {
    this.counter += 1
    return `${prefix}-${this.counter}`
  }

  getState(): SessionState {
    return this.state
  }

  // 1/5 — sendContext: register a context envelope, make it current.
  sendContext({ context }: SendContextArgs): SendContextResult {
    const ref = this.nextRef('ctx')
    const hash = hashContext(context)
    // Defensive deep copy so later mutation of the caller's object can't leak
    // into a stored context (and proves the round-trip is lossless).
    this.contextHistory.push({ ref, envelope: roundTrip(context), hash })
    this.currentContextRef = ref
    this.currentActionRef = null
    this.confirmed = null
    this.state = 'context_set'
    return { contextRef: ref, contextHash: hash, state: this.state }
  }

  // 2/5 — requestAction: run the deterministic engine over the current context.
  async requestAction({
    contextRef,
    action,
    seedOverride,
  }: RequestActionArgs): Promise<RequestActionResult> {
    if (action !== 'generate_menu') {
      throw new ProtocolError('unknown_action', `Unsupported action "${action}".`)
    }
    if (this.currentContextRef !== contextRef) {
      throw new ProtocolError(
        'stale_context',
        `contextRef "${contextRef}" is not the current context (${this.currentContextRef ?? 'none'}). sendContext first.`,
      )
    }
    const entry = this.contextHistory.find((c) => c.ref === contextRef)
    if (entry === undefined) {
      throw new ProtocolError('unknown_context', `No context for ref "${contextRef}".`)
    }
    const input: GenerateMenuInput =
      seedOverride === undefined
        ? entry.envelope.payload
        : { ...entry.envelope.payload, seed: seedOverride }
    const result = await generateMenu(input)
    const verify = verifyResult({ context: entry.envelope, result })
    const actionRef = this.nextRef('act')
    this.actions.set(actionRef, { actionRef, contextRef, result, verify })
    this.currentActionRef = actionRef
    this.state = 'result_ready'
    return { actionRef, contextRef, state: this.state }
  }

  // 3/5 — receiveResult: read back the engine result + verify verdict.
  receiveResult({ actionRef }: ReceiveResultArgs): ReceiveResultResult {
    const stored = this.actions.get(actionRef)
    if (stored === undefined) {
      throw new ProtocolError('unknown_action_ref', `No action for ref "${actionRef}".`)
    }
    return {
      actionRef,
      contextRef: stored.contextRef,
      result: stored.result,
      verify: stored.verify,
      state: this.state,
    }
  }

  // 4/5 — confirm: accept a result (only a green/ok one). Produces acceptedSeed.
  confirm({ actionRef }: ConfirmArgs): ConfirmResult {
    const stored = this.actions.get(actionRef)
    if (stored === undefined) {
      throw new ProtocolError('unknown_action_ref', `No action for ref "${actionRef}".`)
    }
    if (!stored.result.ok) {
      throw new ProtocolError(
        'cannot_confirm_failed',
        'Refusing to confirm a failed generation — rollback and refine instead.',
      )
    }
    const acceptedRef = this.nextRef('acc')
    const acceptedSeed = computeAcceptedSeed(stored.result)
    this.confirmed = { acceptedRef, actionRef, acceptedSeed, state: 'confirmed' }
    this.state = 'confirmed'
    return this.confirmed
  }

  // 5/5 — rollback: discard the current draft/accept, return to the context.
  rollback({ reason }: RollbackArgs = {}): RollbackResult {
    const discardedActionRef = this.currentActionRef
    this.currentActionRef = null
    this.confirmed = null
    this.state = this.currentContextRef === null ? 'idle' : 'context_set'
    return {
      state: this.state,
      restoredContextRef: this.currentContextRef,
      discardedActionRef,
      reason: reason ?? null,
    }
  }
}
