#!/usr/bin/env node
// Runs the comparison experiment and writes the deliverable artifacts:
//   logs/agent-iteration-log.jsonl   — machine-readable iteration log
//   logs/agent-iteration-log.md      — human-readable iteration log
//   logs/experiment-metrics.json     — the measured metrics
//   fixtures/context.feasible.json   — example JSON context snapshot (green)
//   fixtures/context.infeasible.json — example JSON context snapshot (starts red)
// and prints a summary table to stdout.
//
// Deterministic: no timestamps, seeded agent policies. Re-running overwrites
// the artifacts byte-identically. Run with: pnpm --filter
// @weekly-food-planner/mcp-context-bridge experiment

import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  runExperiment,
  makeFeasibleContext,
  makeInfeasibleContext,
} from '../src/index.js'

const here = dirname(fileURLToPath(import.meta.url))
const pkgRoot = join(here, '..')
const logsDir = join(pkgRoot, 'logs')
const fixturesDir = join(pkgRoot, 'fixtures')
mkdirSync(logsDir, { recursive: true })
mkdirSync(fixturesDir, { recursive: true })

const report = await runExperiment()

writeFileSync(join(logsDir, 'agent-iteration-log.jsonl'), report.log.toJsonl())
writeFileSync(join(logsDir, 'agent-iteration-log.md'), report.log.toMarkdown())
writeFileSync(
  join(logsDir, 'experiment-metrics.json'),
  JSON.stringify(
    { config: report.config, baseline: report.baseline.metrics, mcp: report.mcp.metrics },
    null,
    2,
  ) + '\n',
)
writeFileSync(
  join(fixturesDir, 'context.feasible.json'),
  JSON.stringify(makeFeasibleContext(), null, 2) + '\n',
)
writeFileSync(
  join(fixturesDir, 'context.infeasible.json'),
  JSON.stringify(makeInfeasibleContext(), null, 2) + '\n',
)

const fmt = (m) =>
  `${m.flow.padEnd(18)} pass=${m.passRate} meanIters=${m.meanIterations} iterVar=${m.iterationVariance} iters=[${m.iterationsPerRun.join(',')}] distinctDiffs=${m.distinctDiffSignatures}`

console.log('=== MCP context-bridge experiment ===')
console.log(`config: ${JSON.stringify(report.config)}`)
console.log(fmt(report.baseline.metrics))
console.log(fmt(report.mcp.metrics))
console.log(`\nArtifacts written under ${pkgRoot}/{logs,fixtures}`)
