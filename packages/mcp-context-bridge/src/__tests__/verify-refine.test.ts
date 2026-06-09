import { describe, expect, it } from 'vitest'
import { createMcpAgent } from '../agents/mcp-agent.js'
import { runMcpFlow } from '../experiment/run-loop.js'
import { IterationLog } from '../iteration-log.js'
import { makeInfeasibleContext } from '../scenario.js'

// Integration: the verify→refine loop driven through the protocol, against a
// simulated failing generation (3 unsatisfiable required dietary tags →
// no_valid_recipe). The agent response is mocked (a seeded policy) so this runs
// in CI with no live model calls.
describe('verify→refine loop with a simulated failing generation', () => {
  it('starts RED and refines to GREEN through the five verbs', async () => {
    const log = new IterationLog()
    const result = await runMcpFlow({
      agent: createMcpAgent(),
      initialContext: makeInfeasibleContext(),
      agentSeed: 1,
      maxIterations: 8,
      log,
    })

    expect(result.reachedGreen).toBe(true)
    // 3 unsatisfiable tags removed one per step → 3 refinements, 4 generations.
    expect(result.refinements).toBe(3)
    expect(result.iterations).toBe(4)
    expect(result.acceptedSeed).toMatch(/^[0-9a-f]{64}$/)

    const entries = log.all()
    // first verdict is RED (the simulated failing generation)…
    expect(entries[0]?.phase).toBe('verify')
    expect(entries[0]?.verdict?.green).toBe(false)
    expect(entries[0]?.verdict?.failures.some((f) => f.startsWith('generation_failed'))).toBe(true)
    // …diffs were applied…
    expect(entries.filter((e) => e.diffApplied !== null)).toHaveLength(3)
    // …and the run ends on a confirm decision.
    expect(entries.at(-1)?.humanDecision).toContain('confirm')
  })

  it('the MCP agent ignores its RNG seed → zero output variance', async () => {
    const run = (agentSeed: number) =>
      runMcpFlow({
        agent: createMcpAgent(),
        initialContext: makeInfeasibleContext(),
        agentSeed,
        maxIterations: 8,
        log: new IterationLog(),
      })
    const a = await run(1)
    const b = await run(99)
    expect(a.diffSignature).toBe(b.diffSignature)
    expect(a.iterations).toBe(b.iterations)
    expect(a.acceptedSeed).toBe(b.acceptedSeed)
  })
})
