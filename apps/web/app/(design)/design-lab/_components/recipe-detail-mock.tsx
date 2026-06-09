'use client'

import { ChefHat, Clock, Flame, Pencil, Users } from 'lucide-react'
import { CozyShell } from './cozy-shell'
import { MockImage } from './mock-image'
import { resolveRecipeIcon } from './recipe-icon'
import { MOCK_INGREDIENTS, MOCK_RECIPES, MOCK_STEPS } from './mock-data'
import { useLabNav } from './lab-nav'

// kiwilimon / Nestlé recipe page: hero, meta chips, ingredient checklist, numbered
// step cards. No stacked modals — this is a full surface.
export const RecipeDetailMock = () => {
  const navigate = useLabNav()
  return (
    <CozyShell active="recipes" title="Recipe">
      <div className="mx-auto flex max-w-4xl flex-col gap-5">
        {/* Hero */}
        <MockImage
          src={MOCK_RECIPES[1]!.image}
          alt="Creamy Chipotle Pasta"
          emoji={resolveRecipeIcon(MOCK_RECIPES[1]!)}
          className="cozy-card aspect-[16/9] w-full overflow-hidden"
          emojiClassName="text-7xl"
        />

        <div>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="text-2xl font-semibold tracking-tight">Creamy Chipotle Pasta</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                For something rich and lightly spicy — ready in half an hour.
              </p>
            </div>
            {/* #6: edit the recipe; plus a handoff to Cook mode */}
            <div className="flex shrink-0 gap-2">
              <button
                onClick={() => navigate('recipe-create')}
                className="inline-flex items-center gap-2 rounded-full border border-border bg-background px-4 py-2 text-sm font-medium"
              >
                <Pencil className="size-4" /> Edit
              </button>
              <button
                onClick={() => navigate('recipe-cook')}
                className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground cozy-shadow-sm"
              >
                <ChefHat className="size-4" /> Cook
              </button>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap gap-2 text-sm">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1 text-muted-foreground">
              <Clock className="size-4" /> 30 min
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1 text-muted-foreground">
              <Users className="size-4" /> 4 servings
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1 text-muted-foreground">
              <Flame className="size-4" /> Easy
            </span>
          </div>
        </div>

        <div className="grid gap-5 md:grid-cols-[1fr_1.4fr]">
          {/* Ingredients — read-only list (this is the details view; the
              interactive checklist lives in Cook mode). */}
          <div className="cozy-card h-fit bg-card p-5">
            <h3 className="mb-3 font-semibold">Ingredients</h3>
            <ul className="flex flex-col gap-2 text-sm">
              {MOCK_INGREDIENTS.map((ing) => (
                <li key={ing} className="flex items-start gap-2.5">
                  <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-muted-foreground/50" />
                  <span>{ing}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Numbered steps */}
          <div className="flex flex-col gap-3">
            <h3 className="font-semibold">Step by step</h3>
            {MOCK_STEPS.map((step, i) => (
              <div key={i} className="cozy-card flex gap-3 bg-card p-4">
                <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-accent-tint text-sm font-semibold text-accent-strong">
                  {i + 1}
                </span>
                <p className="text-sm leading-relaxed">{step}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </CozyShell>
  )
}
