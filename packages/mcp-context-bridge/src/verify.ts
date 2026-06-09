// The verify step of the verify→refine loop.
//
// Turns a GenerateMenuResult into a green/red verdict. "Green" == the engine
// succeeded AND every derived slot got a recipe. This is the pure equivalent of
// "the tests pass" in the agent dev-loop framing.

import { buildSlots } from '@weekly-food-planner/constraint-engine'
import type { GenerateMenuResult } from '@weekly-food-planner/constraint-engine'
import type { ContextEnvelope, VerifyVerdict } from './types.js'

export const verifyResult = ({
  context,
  result,
}: {
  context: ContextEnvelope
  result: GenerateMenuResult
}): VerifyVerdict => {
  const totalSlots = buildSlots({ input: context.payload }).length

  if (!result.ok) {
    return {
      green: false,
      totalSlots,
      filledSlots: 0,
      unfilledSlots: totalSlots,
      failures: [`generation_failed:${result.error.failedConstraint}`, result.error.reasonCode],
    }
  }

  const filledSlots = result.menu.slots.length
  const unfilledSlots = Math.max(0, totalSlots - filledSlots)
  const failures: string[] = []
  if (unfilledSlots > 0) failures.push(`unfilled_slots:${unfilledSlots}`)

  return {
    green: failures.length === 0 && filledSlots > 0,
    totalSlots,
    filledSlots,
    unfilledSlots,
    failures,
  }
}
