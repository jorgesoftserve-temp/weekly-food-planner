import { describe, expect, it } from 'vitest'
import { runExperiment } from '../experiment/experiment.js'

// The comparison experiment must be deterministic (so the report's numbers are
// reproducible) and must show the MCP flow dominating the naive baseline.
describe('comparison experiment (baseline Module-1 vs MCP flow)', () => {
  it('produces byte-identical metrics across repeated runs', async () => {
    const a = await runExperiment()
    const b = await runExperiment()
    expect(b.mcp.metrics).toEqual(a.mcp.metrics)
    expect(b.baseline.metrics).toEqual(a.baseline.metrics)
  })

  it('MCP flow: converges identically every run (zero variance, one diff signature)', async () => {
    const { mcp } = await runExperiment()
    expect(mcp.metrics.passRate).toBe(1)
    expect(mcp.metrics.iterationVariance).toBe(0)
    expect(mcp.metrics.distinctDiffSignatures).toBe(1)
  })

  it('baseline never beats MCP on mean iterations and is at least as varied', async () => {
    const { baseline, mcp } = await runExperiment()
    expect(baseline.metrics.meanIterations).toBeGreaterThanOrEqual(mcp.metrics.meanIterations)
    expect(baseline.metrics.iterationVariance).toBeGreaterThanOrEqual(mcp.metrics.iterationVariance)
    expect(baseline.metrics.distinctDiffSignatures).toBeGreaterThanOrEqual(
      mcp.metrics.distinctDiffSignatures,
    )
  })
})
