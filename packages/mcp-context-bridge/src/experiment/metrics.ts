// Quantitative metrics for the comparison report.

import type { RunResult } from './run-loop.js'

export const mean = (xs: number[]): number =>
  xs.length === 0 ? 0 : xs.reduce((a, b) => a + b, 0) / xs.length

// Population variance (divide by N). Across the 3 repeated runs this is the
// "variance of agent output" metric the brief asks for.
export const variance = (xs: number[]): number => {
  if (xs.length === 0) return 0
  const m = mean(xs)
  return xs.reduce((a, b) => a + (b - m) ** 2, 0) / xs.length
}

export const round = (x: number, dp = 2): number => {
  const f = 10 ** dp
  return Math.round(x * f) / f
}

export type FlowMetrics = {
  flow: string
  runs: number
  iterationsPerRun: number[]
  refinementsPerRun: number[]
  meanIterations: number
  iterationVariance: number
  passRate: number
  // Distinct ordered diff fingerprints across runs. 1 == every run applied the
  // exact same sequence of changes (no output variance).
  distinctDiffSignatures: number
}

export const summarizeFlow = ({
  flow,
  runs,
}: {
  flow: string
  runs: RunResult[]
}): FlowMetrics => {
  const iterationsPerRun = runs.map((r) => r.iterations)
  const refinementsPerRun = runs.map((r) => r.refinements)
  const passes = runs.filter((r) => r.reachedGreen).length
  const distinctDiffSignatures = new Set(runs.map((r) => r.diffSignature)).size
  return {
    flow,
    runs: runs.length,
    iterationsPerRun,
    refinementsPerRun,
    meanIterations: round(mean(iterationsPerRun)),
    iterationVariance: round(variance(iterationsPerRun)),
    passRate: round(runs.length === 0 ? 0 : passes / runs.length),
    distinctDiffSignatures,
  }
}
