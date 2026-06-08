import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import {
  buildSlots,
  type GenerateMenuInput,
} from '@weekly-food-planner/constraint-engine'
import { engineValidateInputInputShape } from '../schemas.js'
import { textResult, type ToolCallResult } from './shared.js'

// engine.validate_input — pure, no network.
//
// Pre-flight check that catches input problems before a generate run wastes
// the agent's turn on a 422. Mirrors the early-exit checks in
// packages/constraint-engine/src/generate.ts:
//   - members[] is empty → cannot derive slots.
//   - recipes[] is empty → cannot fill slots.
//   - buildSlots() returns 0 slots → frequency cascade resolved to empty.
//   - buildSlots() returns 0 with `now` set but >0 without it → every meal
//     is already in the past (the engine's ALL_MEALS_PASSED case).
//
// Returns counts alongside issues so the agent can sanity-check input scale.

export const engineValidateInputHandler = async ({
  input,
}: {
  input: unknown
}): Promise<ToolCallResult> => {
  const engineInput = input as GenerateMenuInput
  const issues: string[] = []

  if (engineInput.members.length === 0) {
    issues.push('members[] is empty — at least one participating member is required.')
  }
  if (engineInput.recipes.length === 0) {
    issues.push('recipes[] is empty — at least one recipe is required to fill slots.')
  }

  const slots = buildSlots({ input: engineInput })
  let slotsIgnoringNowCount = slots.length
  if (slots.length === 0) {
    if (engineInput.now !== undefined) {
      const slotsIgnoringNow = buildSlots({
        input: { ...engineInput, now: undefined },
      })
      slotsIgnoringNowCount = slotsIgnoringNow.length
      if (slotsIgnoringNow.length > 0) {
        issues.push(
          `Every meal slot for this week is already in the past relative to now=${engineInput.now}. Drop the now filter or pick a later weekStartDate to recover ${slotsIgnoringNow.length} slot(s).`,
        )
      } else {
        issues.push(
          'No meal slots could be derived. Configure meal_frequency on the workspace or its members.',
        )
      }
    } else {
      issues.push(
        'No meal slots could be derived. Configure meal_frequency on the workspace or its members.',
      )
    }
  }

  return textResult({
    ok: issues.length === 0,
    slotCount: slots.length,
    slotsIgnoringNowCount,
    memberCount: engineInput.members.length,
    recipeCount: engineInput.recipes.length,
    ingredientCount: engineInput.ingredients.length,
    issues,
  })
}

export const registerEngineValidateInput = (server: McpServer): void => {
  server.registerTool(
    'engine_validate_input',
    {
      description:
        'Pre-flight check for a GenerateMenuInput — verifies members/recipes are non-empty and that the frequency cascade resolves to a positive slot count. Distinguishes "no frequency configured" from "every meal already in the past" using a now-filter probe. Returns { ok, slotCount, slotsIgnoringNowCount, memberCount, recipeCount, ingredientCount, issues[] }. Pure — no DB, no network.',
      inputSchema: engineValidateInputInputShape,
    },
    engineValidateInputHandler,
  )
}
