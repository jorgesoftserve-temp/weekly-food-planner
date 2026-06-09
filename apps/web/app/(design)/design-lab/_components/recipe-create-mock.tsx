'use client'

import { GripVertical, ImagePlus, Plus, Trash2 } from 'lucide-react'
import { CozyShell } from './cozy-shell'
import { MOCK_STEPS } from './mock-data'
import { useLabNav } from './lab-nav'

const FIELD =
  'w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm cozy-shadow-sm'
const LABEL = 'text-sm font-medium'

// New-recipe form in the cozy style: photo dropzone, rounded fields, pill chips,
// repeatable ingredient/step rows. Single full-page surface (no modal).
export const RecipeCreateMock = () => {
  const navigate = useLabNav()
  return (
    <CozyShell active="recipes" title="New recipe">
      <div className="mx-auto flex max-w-3xl flex-col gap-5">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">Create a recipe</h2>
          <p className="text-sm text-muted-foreground">
            Add it to the pool the menu generator picks from.
          </p>
        </div>

        {/* Photo dropzone */}
        <div className="cozy-card flex flex-col items-center justify-center gap-2 border border-dashed border-border bg-gradient-empty py-10 text-muted-foreground">
          <ImagePlus className="size-6" />
          <span className="text-sm">Drop a cover photo or click to upload</span>
        </div>

        <div className="cozy-card flex flex-col gap-4 bg-card p-5">
          <div className="flex flex-col gap-1.5">
            <label className={LABEL}>Recipe name</label>
            <input className={FIELD} defaultValue="Creamy Chipotle Pasta" />
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="flex flex-col gap-1.5">
              <label className={LABEL}>Meal</label>
              <select className={FIELD} defaultValue="Dinner">
                <option>Breakfast</option>
                <option>Lunch</option>
                <option>Dinner</option>
                <option>Snack</option>
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className={LABEL}>Servings</label>
              <input className={FIELD} type="number" defaultValue={4} />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className={LABEL}>Difficulty</label>
              <select className={FIELD} defaultValue="Easy">
                <option>Easy</option>
                <option>Medium</option>
                <option>Hard</option>
              </select>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className={LABEL}>Dietary tags</label>
            <div className="flex flex-wrap gap-2">
              {['Vegetarian', 'High protein', 'Comfort'].map((t) => (
                <span
                  key={t}
                  className="inline-flex items-center gap-1 rounded-full bg-accent-tint px-3 py-1 text-sm text-accent-strong"
                >
                  {t}
                </span>
              ))}
              <span className="inline-flex items-center gap-1 rounded-full border border-dashed border-border px-3 py-1 text-sm text-muted-foreground">
                <Plus className="size-3.5" /> Add tag
              </span>
            </div>
          </div>
        </div>

        {/* Ingredients */}
        <div className="cozy-card flex flex-col gap-3 bg-card p-5">
          <h3 className="font-semibold">Ingredients</h3>
          {['Cream cheese', 'Chipotle in adobo', 'Chicken breast'].map((ing) => (
            <div key={ing} className="flex items-center gap-2">
              <input className={FIELD} defaultValue={ing} />
              <input className="w-24 rounded-xl border border-border bg-background px-3 py-2.5 text-sm cozy-shadow-sm" defaultValue="200 g" />
              <button className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-border text-muted-foreground">
                <Trash2 className="size-4" />
              </button>
            </div>
          ))}
          <button className="inline-flex w-fit items-center gap-2 rounded-full border border-dashed border-border px-4 py-2 text-sm text-muted-foreground">
            <Plus className="size-4" /> Add ingredient
          </button>
        </div>

        {/* Instructions (#5) — repeatable numbered step rows, mirrors detail/cook */}
        <div className="cozy-card flex flex-col gap-3 bg-card p-5">
          <h3 className="font-semibold">Instructions</h3>
          {MOCK_STEPS.slice(0, 3).map((step, i) => (
            <div key={i} className="flex items-start gap-2">
              <span className="mt-2.5 flex shrink-0 items-center gap-1 text-muted-foreground">
                <GripVertical className="size-4" />
                <span className="flex size-6 items-center justify-center rounded-full bg-accent-tint text-xs font-semibold text-accent-strong">
                  {i + 1}
                </span>
              </span>
              <textarea
                rows={2}
                defaultValue={step}
                className="w-full resize-none rounded-xl border border-border bg-background px-3 py-2.5 text-sm cozy-shadow-sm"
              />
              <button className="mt-1 flex size-10 shrink-0 items-center justify-center rounded-xl border border-border text-muted-foreground">
                <Trash2 className="size-4" />
              </button>
            </div>
          ))}
          <button className="inline-flex w-fit items-center gap-2 rounded-full border border-dashed border-border px-4 py-2 text-sm text-muted-foreground">
            <Plus className="size-4" /> Add step
          </button>
        </div>

        {/* Footer actions */}
        <div className="flex justify-end gap-2">
          <button
            onClick={() => navigate('recipes')}
            className="rounded-full border border-border bg-background px-5 py-2.5 text-sm font-medium"
          >
            Cancel
          </button>
          <button
            onClick={() => navigate('recipes')}
            className="rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground cozy-shadow-sm"
          >
            Save recipe
          </button>
        </div>
      </div>
    </CozyShell>
  )
}
