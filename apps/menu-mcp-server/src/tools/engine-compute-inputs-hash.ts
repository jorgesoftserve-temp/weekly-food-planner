import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import {
  sha256OfInput,
  type GenerateMenuInput,
} from '@weekly-food-planner/constraint-engine'
import { engineComputeInputsHashInputShape } from '../schemas.js'
import { textResult, type ToolCallResult } from './shared.js'

// engine.compute_inputs_hash — pure, no network.
//
// Returns the canonical sha256 of a GenerateMenuInput. Matches the
// `inputs_hash` the persisting route handler writes alongside an accepted
// menu, so agents can use this to:
//   - Check whether two inputs hash identically (overlay dedup is correct).
//   - Reproduce a prior menu by feeding the same input back through the
//     engine and verifying the hash.

export const engineComputeInputsHashHandler = async ({
  input,
}: {
  input: unknown
}): Promise<ToolCallResult> => {
  const inputsHash = await sha256OfInput({
    value: input as GenerateMenuInput,
  })
  return textResult({ inputsHash })
}

export const registerEngineComputeInputsHash = (server: McpServer): void => {
  server.registerTool(
    'engine_compute_inputs_hash',
    {
      description:
        'Computes the canonical sha256 hash of a GenerateMenuInput. Pure — no DB, no network. The result matches the `inputs_hash` written by POST /menus (weekly mode), so this is the right tool for "would these two inputs produce the same menu?" and for reproducibility checks against an accepted menu.',
      inputSchema: engineComputeInputsHashInputShape,
    },
    engineComputeInputsHashHandler,
  )
}
