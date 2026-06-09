// The two verify→refine loop drivers compared in the experiment.
//
//   runMcpFlow      — routes every step through the five protocol verbs
//                     (sendContext → requestAction → receiveResult →
//                      confirm | rollback) and uses the structured agent.
//   runBaselineFlow — the "Module-1" baseline: a direct generateMenu() loop
//                     with no protocol mediation and the blind agent.
//
// Both verify with the same pure verifyResult and write to the same
// IterationLog, so the only differences measured are the protocol + the agent
// it enables.

import { createRng, generateMenu } from '@weekly-food-planner/constraint-engine'
import { createInProcessClient } from '../client.js'
import { IterationLog, summarizeContext } from '../iteration-log.js'
import { verifyResult } from '../verify.js'
import type { RefinementAgent } from '../agents/types.js'
import type { ContextEnvelope } from '../types.js'

export type RunResult = {
  flow: string
  agentSeed: number
  reachedGreen: boolean
  iterations: number // engine generations performed
  refinements: number // agent proposals applied
  acceptedSeed: string | null
  diffSignature: string // ordered diff fingerprint of the run
}

export type LoopArgs = {
  agent: RefinementAgent
  initialContext: ContextEnvelope
  agentSeed: number
  maxIterations: number
  log: IterationLog
}

export const runMcpFlow = async ({
  agent,
  initialContext,
  agentSeed,
  maxIterations,
  log,
}: LoopArgs): Promise<RunResult> => {
  const client = createInProcessClient()
  const rng = createRng({ seed: agentSeed })
  let context = initialContext
  let iterations = 0
  let refinements = 0
  let acceptedSeed: string | null = null
  let reachedGreen = false
  const diffOps: string[] = []

  for (let step = 0; step < maxIterations; step += 1) {
    const sent = await client.sendContext({ context })
    const requested = await client.requestAction({
      contextRef: sent.contextRef,
      action: 'generate_menu',
    })
    const received = await client.receiveResult({ actionRef: requested.actionRef })
    iterations += 1

    log.record({
      flow: agent.name,
      agentSeed,
      step,
      phase: 'verify',
      prompt: `[MCP] sendContext→requestAction→receiveResult for "${context.intent}", then verify.`,
      inputContextRef: sent.contextRef,
      inputContextHash: sent.contextHash,
      inputContextSummary: summarizeContext(context),
      agentOutput: received.verify.green
        ? `verify: GREEN — ${received.verify.filledSlots}/${received.verify.totalSlots} slots filled`
        : `verify: RED — ${received.verify.failures.join(', ')}`,
      verdict: received.verify,
      diffApplied: null,
      humanDecision: received.verify.green
        ? 'confirm (accept menu)'
        : 'rollback failed draft, then refine',
    })

    if (received.verify.green) {
      const confirmed = await client.confirm({ actionRef: requested.actionRef })
      acceptedSeed = confirmed.acceptedSeed
      reachedGreen = true
      break
    }

    await client.rollback({ reason: received.verify.failures.join(',') })
    const proposal = agent.propose({
      context,
      lastResult: received.result,
      lastVerdict: received.verify,
      rng,
      iteration: step,
    })
    if (proposal === null) break
    diffOps.push(`${proposal.diff.field}:${proposal.diff.op}`)
    refinements += 1

    log.record({
      flow: agent.name,
      agentSeed,
      step,
      phase: 'refine',
      prompt: '[MCP] Given the structured RED verdict + context, propose the next context.',
      inputContextRef: sent.contextRef,
      inputContextHash: sent.contextHash,
      inputContextSummary: summarizeContext(context),
      agentOutput: proposal.rationale,
      verdict: null,
      diffApplied: proposal.diff,
      humanDecision: 'accept refinement → resend context',
    })
    context = proposal.nextContext
  }

  return {
    flow: agent.name,
    agentSeed,
    reachedGreen,
    iterations,
    refinements,
    acceptedSeed,
    diffSignature: diffOps.join(' > '),
  }
}

export const runBaselineFlow = async ({
  agent,
  initialContext,
  agentSeed,
  maxIterations,
  log,
}: LoopArgs): Promise<RunResult> => {
  const rng = createRng({ seed: agentSeed })
  let context = initialContext
  let iterations = 0
  let refinements = 0
  let reachedGreen = false
  const diffOps: string[] = []

  for (let step = 0; step < maxIterations; step += 1) {
    // No protocol: a direct engine call, the agent only sees the ok flag.
    const result = await generateMenu(context.payload)
    const verdict = verifyResult({ context, result })
    iterations += 1

    log.record({
      flow: agent.name,
      agentSeed,
      step,
      phase: 'verify',
      prompt: `[baseline] Direct generateMenu(input) for "${context.intent}"; check the ok flag.`,
      inputContextRef: null,
      inputContextHash: null,
      inputContextSummary: summarizeContext(context),
      agentOutput: verdict.green ? 'ok:true — looks done' : 'ok:false — failed, will guess a change',
      verdict,
      diffApplied: null,
      humanDecision: verdict.green
        ? 'keep result (no confirm step exists in baseline)'
        : 'discard + guess (no rollback bookkeeping)',
    })

    if (verdict.green) {
      reachedGreen = true
      break
    }

    const proposal = agent.propose({
      context,
      lastResult: result,
      lastVerdict: verdict,
      rng,
      iteration: step,
    })
    if (proposal === null) break
    diffOps.push(`${proposal.diff.field}:${proposal.diff.op}`)
    refinements += 1

    log.record({
      flow: agent.name,
      agentSeed,
      step,
      phase: 'refine',
      prompt: '[baseline] Last run failed. Guess a change (no structured feedback available).',
      inputContextRef: null,
      inputContextHash: null,
      inputContextSummary: summarizeContext(context),
      agentOutput: proposal.rationale,
      verdict: null,
      diffApplied: proposal.diff,
      humanDecision: 'apply blind guess → rerun',
    })
    context = proposal.nextContext
  }

  return {
    flow: agent.name,
    agentSeed,
    reachedGreen,
    iterations,
    refinements,
    acceptedSeed: null,
    diffSignature: diffOps.join(' > '),
  }
}
