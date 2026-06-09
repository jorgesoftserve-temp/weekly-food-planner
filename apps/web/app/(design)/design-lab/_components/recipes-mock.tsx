'use client'

import { Clock, Plus, Search } from 'lucide-react'
import { CozyShell } from './cozy-shell'
import { MockImage } from './mock-image'
import { resolveRecipeIcon } from './recipe-icon'
import { MOCK_RECIPES } from './mock-data'
import { useLabNav } from './lab-nav'

const FILTERS = ['All', 'Breakfast', 'Lunch', 'Dinner', 'Vegetarian', 'Quick']

// Image-forward card grid (Airbnb / cookpad / kiwilimon). Filter chips on top.
export const RecipesMock = () => {
  const navigate = useLabNav()
  return (
    <CozyShell active="recipes" title="Recipes">
      <div className="mx-auto flex max-w-5xl flex-col gap-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-xl font-semibold tracking-tight">Your recipes</h2>
            <p className="text-sm text-muted-foreground">
              The pool the menu generator picks from.
            </p>
          </div>
          <button
            onClick={() => navigate('recipe-create')}
            className="inline-flex w-fit items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground cozy-shadow-sm"
          >
            <Plus className="size-4" /> New recipe
          </button>
        </div>

        {/* Search + filter chips */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => navigate('search')}
            className="flex items-center gap-2 rounded-full border border-border bg-background px-3 py-2 text-sm text-muted-foreground"
          >
            <Search className="size-4" /> Search recipes…
          </button>
          {FILTERS.map((f, i) => (
            <span
              key={f}
              className={
                i === 0
                  ? 'rounded-full bg-accent-tint px-3 py-1.5 text-sm font-medium text-accent-strong'
                  : 'rounded-full border border-border px-3 py-1.5 text-sm text-muted-foreground'
              }
            >
              {f}
            </span>
          ))}
        </div>

        {/* Card grid */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {MOCK_RECIPES.map((r) => (
            <button
              key={r.id}
              onClick={() => navigate('recipe')}
              className="cozy-card cozy-lift flex cursor-pointer flex-col overflow-hidden bg-card text-left"
            >
              <MockImage
                src={r.image}
                alt={r.name}
                emoji={resolveRecipeIcon(r)}
                className="h-36 w-full"
              />
              <div className="flex flex-1 flex-col gap-2 p-4">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-semibold leading-tight">{r.name}</h3>
                </div>
                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <span className="rounded-full bg-muted px-2 py-0.5">{r.meal}</span>
                  <span className="rounded-full bg-muted px-2 py-0.5">{r.cuisine}</span>
                  <span className="inline-flex items-center gap-1">
                    <Clock className="size-3" /> {r.minutes}m
                  </span>
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>
    </CozyShell>
  )
}
