// The shared experiment scenario: a deliberately over-constrained menu request
// that the engine cannot satisfy (a "simulated failing generation"), which the
// verify→refine loop must repair to green.
//
// The recipes carry NO dietary tags, so any `additionalDietaryRestrictions`
// (which the engine treats as REQUIRED tags — see filter.ts recipeMissesDietaryTag)
// filters every recipe out → assignGreedy fails → ok:false. Removing the
// offending restrictions restores feasibility.

import { makeGenerateMenuInput, makeRecipe } from '@weekly-food-planner/constraint-engine/test-utils'
import type { ContextEnvelope } from './types.js'

// Required tags that no recipe in the scenario carries — the source of the
// initial infeasibility. Sorted so the smart agent's removal order is stable.
export const OVER_CONSTRAINTS = ['gluten-free', 'keto', 'vegan']

const baseInput = () =>
  makeGenerateMenuInput({
    seed: 42,
    recipes: [
      makeRecipe({ id: 'r-bf-1', mealType: 'breakfast', dietaryTags: [] }),
      makeRecipe({ id: 'r-bf-2', mealType: 'breakfast', dietaryTags: [] }),
      makeRecipe({ id: 'r-dn-1', mealType: 'dinner', dietaryTags: [] }),
      makeRecipe({ id: 'r-dn-2', mealType: 'dinner', dietaryTags: [] }),
    ],
  })

// The starting (red) context every run begins from.
export const makeInfeasibleContext = (): ContextEnvelope => ({
  kind: 'menu-generation',
  intent: 'Plan a feasible breakfast+dinner week; start over-constrained and refine to green.',
  payload: {
    ...baseInput(),
    options: { additionalDietaryRestrictions: [...OVER_CONSTRAINTS] },
  },
  meta: { createdBy: 'experiment', note: 'seeded infeasible scenario (3 unsatisfiable required tags)' },
})

// A directly-feasible context (no over-constraints) — used by the happy-path
// round-trip test and shipped as a fixture.
export const makeFeasibleContext = (): ContextEnvelope => ({
  kind: 'menu-generation',
  intent: 'Plan a feasible breakfast+dinner week.',
  payload: baseInput(),
  meta: { createdBy: 'experiment' },
})
