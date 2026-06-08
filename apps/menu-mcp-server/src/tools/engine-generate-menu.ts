import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import {
  generateMenu,
  type GenerateMenuInput,
} from '@weekly-food-planner/constraint-engine'
import { engineGenerateMenuInputShape } from '../schemas.js'
import { textResult, type ToolCallResult } from './shared.js'

// engine.generate_menu — pure engine wrapper.
//
// Calls @weekly-food-planner/constraint-engine's `generateMenu` directly. No
// network, no DB. Deterministic for `(input, seed)`. The agent supplies the
// full GenerateMenuInput JSON — typically copied from a prior
// `workspace.preview_menu` response or hand-built for engine-only tests.
//
// When `seed` is supplied at the top level, it overrides `input.seed`. This
// is the cheapest way to drive a "regenerate with a different seed" loop.

export const engineGenerateMenuHandler = async ({
  input,
  seed,
}: {
  input: unknown
  seed?: number
}): Promise<ToolCallResult> => {
  const effectiveInput: GenerateMenuInput =
    seed === undefined
      ? (input as GenerateMenuInput)
      : { ...(input as GenerateMenuInput), seed }
  const result = await generateMenu(effectiveInput)
  return textResult(result)
}

export const registerEngineGenerateMenu = (server: McpServer): void => {
  server.registerTool(
    'engine_generate_menu',
    {
      description:
        'Runs the deterministic constraint engine on a fully-formed GenerateMenuInput and returns the GenerateMenuResult (either ok:true with menu+groceryLists+inputsHash, or ok:false with a structured GenerationError). Pure — no DB, no network. Same input + same seed always produces the same output. Optionally pass a top-level `seed` to override input.seed for this call without rebuilding the input.',
      inputSchema: engineGenerateMenuInputShape,
    },
    engineGenerateMenuHandler,
  )
}
