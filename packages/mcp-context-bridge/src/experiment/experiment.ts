// The comparison experiment: 3 controlled runs of the baseline (Module-1) flow
// and 3 runs of the MCP flow over the same infeasible scenario, with metrics.
//
// Fully deterministic: agent responses are mocked (seeded policies), so CI can
// exercise the whole thing without any live model calls. Re-running yields
// byte-identical metrics and iteration log.

import { createMcpAgent } from '../agents/mcp-agent.js'
import { createNaiveAgent } from '../agents/naive-agent.js'
import { IterationLog } from '../iteration-log.js'
import { makeInfeasibleContext } from '../scenario.js'
import { summarizeFlow, type FlowMetrics } from './metrics.js'
import { runBaselineFlow, runMcpFlow, type RunResult } from './run-loop.js'

export type ExperimentConfig = {
  runsPerFlow: number
  maxIterations: number
  agentSeeds: number[]
}

export const DEFAULT_EXPERIMENT: ExperimentConfig = {
  runsPerFlow: 3,
  maxIterations: 8,
  agentSeeds: [1, 2, 3],
}

export type ExperimentReport = {
  config: ExperimentConfig
  baseline: { metrics: FlowMetrics; runs: RunResult[] }
  mcp: { metrics: FlowMetrics; runs: RunResult[] }
  log: IterationLog
}

export const runExperiment = async (
  config: ExperimentConfig = DEFAULT_EXPERIMENT,
): Promise<ExperimentReport> => {
  const log = new IterationLog()
  const seeds = config.agentSeeds.slice(0, config.runsPerFlow)

  const baselineRuns: RunResult[] = []
  for (const agentSeed of seeds) {
    baselineRuns.push(
      await runBaselineFlow({
        agent: createNaiveAgent(),
        initialContext: makeInfeasibleContext(),
        agentSeed,
        maxIterations: config.maxIterations,
        log,
      }),
    )
  }

  const mcpRuns: RunResult[] = []
  for (const agentSeed of seeds) {
    mcpRuns.push(
      await runMcpFlow({
        agent: createMcpAgent(),
        initialContext: makeInfeasibleContext(),
        agentSeed,
        maxIterations: config.maxIterations,
        log,
      }),
    )
  }

  return {
    config,
    baseline: { metrics: summarizeFlow({ flow: 'baseline-module1', runs: baselineRuns }), runs: baselineRuns },
    mcp: { metrics: summarizeFlow({ flow: 'mcp-bridge', runs: mcpRuns }), runs: mcpRuns },
    log,
  }
}
