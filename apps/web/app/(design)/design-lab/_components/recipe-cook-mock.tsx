'use client'

import { useState } from 'react'
import { CalendarRange, Check, PartyPopper } from 'lucide-react'
import { cn } from '@/lib/utils'
import { CozyShell } from './cozy-shell'
import { MockImage } from './mock-image'
import { resolveRecipeIcon } from './recipe-icon'
import { MOCK_INGREDIENTS, MOCK_RECIPES, MOCK_STEPS } from './mock-data'
import { useLabNav } from './lab-nav'

// "Cook mode" / recipe checklist — what the user reads while cooking the dish
// from their weekly menu. Unlike the details view, BOTH ingredients AND
// instructions are checkable so they can track progress hands-on. Fully
// interactive here: once EVERY instruction is checked, a "Mark as cooked" button
// completes the dish and returns to the menu (#7).
// (Proposed product addition — not yet in any PRD; see v1.8-ui-mockups.md.)
const toggle = (set: Set<number>, i: number): Set<number> => {
  const next = new Set(set)
  if (next.has(i)) next.delete(i)
  else next.add(i)
  return next
}

export const RecipeCookMock = () => {
  const navigate = useLabNav()
  const recipe = MOCK_RECIPES[1]!
  // Seed a few as already done so the screen reads mid-cook.
  const [ingredients, setIngredients] = useState<Set<number>>(() => new Set([0, 1, 2]))
  const [steps, setSteps] = useState<Set<number>>(() => new Set([0, 1]))

  const totalChecks = MOCK_INGREDIENTS.length + MOCK_STEPS.length
  const doneChecks = ingredients.size + steps.size
  const allStepsDone = steps.size === MOCK_STEPS.length

  return (
    <CozyShell active="menu" title="Cook mode">
      <div className="mx-auto flex max-w-2xl flex-col gap-5">
        {/* Context header — they got here from the menu */}
        <div className="cozy-card flex items-center gap-4 bg-gradient-hero p-4">
          <MockImage
            src={recipe.image}
            alt={recipe.name}
            emoji={resolveRecipeIcon(recipe)}
            className="size-16 shrink-0 rounded-2xl"
            emojiClassName="text-3xl"
          />
          <div className="min-w-0">
            <p className="flex items-center gap-1.5 text-xs font-medium text-accent-strong">
              <CalendarRange className="size-3.5" /> From this week&apos;s menu · Tuesday dinner
            </p>
            <h2 className="mt-0.5 truncate text-xl font-semibold tracking-tight">{recipe.name}</h2>
            <p className="text-sm text-muted-foreground">
              {doneChecks} of {totalChecks} checked
            </p>
          </div>
        </div>

        {/* Ingredients — checkable */}
        <div className="cozy-card bg-card p-5">
          <h3 className="mb-3 font-semibold">Ingredients</h3>
          <ul className="flex flex-col gap-1">
            {MOCK_INGREDIENTS.map((ing, i) => {
              const done = ingredients.has(i)
              return (
                <li key={ing}>
                  <button
                    type="button"
                    onClick={() => setIngredients((s) => toggle(s, i))}
                    className="flex min-h-11 w-full cursor-pointer items-center gap-3 text-left text-sm"
                  >
                    <span
                      className={
                        done
                          ? 'flex size-6 shrink-0 items-center justify-center rounded-full bg-success-tint text-success'
                          : 'size-6 shrink-0 rounded-full border-2 border-border'
                      }
                    >
                      {done ? <Check className="size-4" /> : null}
                    </span>
                    <span className={done ? 'text-muted-foreground line-through' : ''}>{ing}</span>
                  </button>
                </li>
              )
            })}
          </ul>
        </div>

        {/* Instructions — checkable numbered steps */}
        <div className="cozy-card bg-card p-5">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="font-semibold">Instructions</h3>
            <span className="text-xs text-muted-foreground">
              {steps.size} of {MOCK_STEPS.length} steps
            </span>
          </div>
          <ol className="flex flex-col gap-2">
            {MOCK_STEPS.map((step, i) => {
              const done = steps.has(i)
              return (
                <li key={i}>
                  <button
                    type="button"
                    onClick={() => setSteps((s) => toggle(s, i))}
                    className="flex w-full cursor-pointer items-start gap-3 text-left"
                  >
                    <span
                      className={
                        done
                          ? 'flex size-7 shrink-0 items-center justify-center rounded-full bg-success-tint text-success'
                          : 'flex size-7 shrink-0 items-center justify-center rounded-full bg-accent-tint text-sm font-semibold text-accent-strong'
                      }
                    >
                      {done ? <Check className="size-4" /> : i + 1}
                    </span>
                    <p
                      className={
                        done
                          ? 'pt-0.5 text-sm leading-relaxed text-muted-foreground line-through'
                          : 'pt-0.5 text-sm leading-relaxed'
                      }
                    >
                      {step}
                    </p>
                  </button>
                </li>
              )
            })}
          </ol>
        </div>

        {/* Complete — appears enabled once every instruction is checked (#7) */}
        <button
          type="button"
          disabled={!allStepsDone}
          onClick={() => allStepsDone && navigate('menu')}
          className={cn(
            'inline-flex items-center justify-center gap-2 rounded-full px-5 py-3 text-sm font-semibold transition',
            allStepsDone
              ? 'bg-success-tint text-success cozy-shadow-sm'
              : 'cursor-not-allowed border border-border bg-muted text-muted-foreground',
          )}
        >
          {allStepsDone ? <PartyPopper className="size-4" /> : <Check className="size-4" />}
          {allStepsDone ? 'Mark as cooked' : 'Check off every step to finish'}
        </button>
      </div>
    </CozyShell>
  )
}
