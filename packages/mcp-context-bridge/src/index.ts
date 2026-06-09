// Public surface of the MCP context bridge.

export * from './types.js'
export {
  contextEnvelopeSchema,
  canonicalJson,
  sha256Hex,
  hashContext,
  roundTrip,
} from './schema.js'
export { verifyResult } from './verify.js'
export { ProtocolSession, ProtocolError } from './session.js'
export { InProcessTransport, type ProtocolTransport } from './transport.js'
export { ContextBridgeClient, createInProcessClient } from './client.js'

// Scenario + agents + experiment harness
export { makeInfeasibleContext, makeFeasibleContext, OVER_CONSTRAINTS } from './scenario.js'
export { IterationLog, summarizeContext, type IterationLogEntry } from './iteration-log.js'
export {
  type RefinementAgent,
  type RefinementInput,
  type RefinementProposal,
} from './agents/types.js'
export { createMcpAgent } from './agents/mcp-agent.js'
export { createNaiveAgent } from './agents/naive-agent.js'
export { runMcpFlow, runBaselineFlow, type RunResult, type LoopArgs } from './experiment/run-loop.js'
export { summarizeFlow, mean, variance, round, type FlowMetrics } from './experiment/metrics.js'
export {
  runExperiment,
  DEFAULT_EXPERIMENT,
  type ExperimentConfig,
  type ExperimentReport,
} from './experiment/experiment.js'
