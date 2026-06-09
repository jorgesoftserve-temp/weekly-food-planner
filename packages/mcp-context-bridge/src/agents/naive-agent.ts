// Module-1 baseline agent — blind, RNG-driven.
//
// It does NOT read the structured result; it only knows "the last attempt
// failed" and picks a move from a fixed repertoire at random. Two of the moves
// (bump seed, add a preferred cuisine) do nothing for dietary-tag feasibility,
// so they are wasted iterations. Different RNG seeds → different move sequences
// → non-zero output variance and more iterations to green.

import {
  getRestrictions,
  withPreferredCuisines,
  withRestrictions,
  withSeed,
  type RefinementAgent,
  type RefinementInput,
  type RefinementProposal,
} from './types.js'

// Repertoire weighted toward "drop" so the loop still tends to converge, but
// with real waste from the two no-op moves.
const MOVES = ['drop', 'drop', 'bump_seed', 'add_cuisine'] as const

export const createNaiveAgent = (): RefinementAgent => ({
  name: 'baseline-module1',
  propose({ context, rng, iteration }: RefinementInput): RefinementProposal | null {
    const move = MOVES[Math.floor(rng.next() * MOVES.length)] as (typeof MOVES)[number]
    const restrictions = getRestrictions(context)

    if (move === 'drop' && restrictions.length > 0) {
      const idx = Math.floor(rng.next() * restrictions.length)
      const drop = restrictions[idx] as string
      const next = restrictions.filter((_, i) => i !== idx)
      return {
        rationale: `Blind guess: drop restriction "${drop}" (no idea if it is the offender).`,
        nextContext: withRestrictions(context, next),
        diff: {
          field: 'options.additionalDietaryRestrictions',
          op: 'remove',
          from: restrictions,
          to: next,
          note: `blindly dropped "${drop}"`,
        },
      }
    }

    if (move === 'bump_seed' || (move === 'drop' && restrictions.length === 0)) {
      const seed = context.payload.seed + 1
      return {
        rationale: 'Blind guess: reroll the engine seed and hope it changes feasibility.',
        nextContext: withSeed(context, seed),
        diff: {
          field: 'seed',
          op: 'bump',
          from: context.payload.seed,
          to: seed,
          note: 'no-op for feasibility (wasted move)',
        },
      }
    }

    // add_cuisine — also a no-op for dietary-tag feasibility.
    const cuisines = [
      ...(context.payload.options?.preferredCuisines ?? []),
      `cuisine-${iteration}`,
    ]
    return {
      rationale: 'Blind guess: add a preferred cuisine and hope.',
      nextContext: withPreferredCuisines(context, cuisines),
      diff: {
        field: 'options.preferredCuisines',
        op: 'add',
        from: context.payload.options?.preferredCuisines ?? [],
        to: cuisines,
        note: 'no-op for feasibility (wasted move)',
      },
    }
  },
})
