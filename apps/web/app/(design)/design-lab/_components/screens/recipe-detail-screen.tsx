'use client'

import { useState } from 'react'
import {
  CheckCircle2,
  Clock,
  Flame,
  Package,
  Play,
  Refrigerator,
  UtensilsCrossed,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { CozyShell } from '../cozy-shell'
import { MOCK_RECIPES, MOCK_STEPS, MOCK_INGREDIENTS } from '../mock-data'

// ── Mock recipe ───────────────────────────────────────────────────────────────
// Use Creamy Chipotle Pasta (id r2) — it has a nice mix of meal + detail data.

const MOCK_RECIPE = MOCK_RECIPES[1]!

// ── On-the-fly cook sheet ─────────────────────────────────────────────────────
// Opened via "Cook now" — ephemeral cook mode for any recipe without it being on
// the active menu (§24, Track D). No menu write. Optional leftover saves.
// Reuses the v2.0 cook-time reconciliation pattern from MenuExecScreen.

type StepStatus = 'pending' | 'done' | 'skipped'

type OnTheFlyCookSheetProps = {
  open: boolean
  recipeName: string
  onClose: () => void
}

const OnTheFlyCookSheet = ({ open, recipeName, onClose }: OnTheFlyCookSheetProps) => {
  const [stepStatuses, setStepStatuses] = useState<StepStatus[]>(
    MOCK_STEPS.map(() => 'pending'),
  )
  const [saveLeftovers, setSaveLeftovers] = useState(false)
  const [saved, setSaved] = useState(false)

  const doneCount = stepStatuses.filter((s) => s === 'done').length
  const progress = Math.round((doneCount / MOCK_STEPS.length) * 100)

  const toggleStep = (idx: number) => {
    setStepStatuses((prev) =>
      prev.map((s, i) => {
        if (i !== idx) return s
        return s === 'done' ? 'pending' : 'done'
      }),
    )
  }

  const handleFinish = () => {
    setSaved(true)
    setTimeout(onClose, 800)
  }

  return (
    <Sheet open={open} onOpenChange={(v) => { if (!v) onClose() }}>
      <SheetContent side="right" className="flex w-full flex-col gap-0 sm:max-w-lg">
        <SheetHeader className="pb-3">
          <SheetTitle className="flex items-center gap-2">
            <Play className="size-4 text-success" aria-hidden />
            Cook now
          </SheetTitle>
          <SheetDescription>
            On-the-fly cook mode for{' '}
            <strong>{recipeName}</strong>. This is ephemeral — the active menu
            is not changed.
          </SheetDescription>
        </SheetHeader>

        {/* Progress bar */}
        <div className="mb-4 flex flex-col gap-1.5">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>{doneCount} of {MOCK_STEPS.length} steps done</span>
            <span>{progress}%</span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full bg-success transition-all duration-300"
              style={{ width: `${progress}%` }}
              role="progressbar"
              aria-valuenow={progress}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label="Cook progress"
            />
          </div>
        </div>

        {/* Steps */}
        <div className="flex flex-1 flex-col gap-2 overflow-y-auto" role="list" aria-label="Recipe steps">
          {MOCK_STEPS.map((step, idx) => {
            const status = stepStatuses[idx]!
            const checkId = `cook-step-${idx}`
            return (
              <div
                key={idx}
                role="listitem"
                className={cn(
                  'flex items-start gap-3 rounded-xl border border-border bg-card p-3 transition',
                  status === 'done' && 'border-success/30 bg-success-tint/10',
                )}
              >
                <span
                  className={cn(
                    'flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold',
                    status === 'done'
                      ? 'bg-success text-white'
                      : 'bg-accent-tint text-accent-strong',
                  )}
                  aria-hidden
                >
                  {status === 'done' ? <CheckCircle2 className="size-3.5" /> : idx + 1}
                </span>
                <p
                  className={cn(
                    'flex-1 text-sm leading-relaxed',
                    status === 'done' && 'text-muted-foreground line-through',
                  )}
                >
                  {step}
                </p>
                <Checkbox
                  id={checkId}
                  checked={status === 'done'}
                  onCheckedChange={() => toggleStep(idx)}
                  aria-label={`Mark step ${idx + 1} as done`}
                  className="mt-0.5"
                />
              </div>
            )
          })}
        </div>

        {/* Optional leftover save */}
        <div className="mt-4 flex items-center justify-between gap-3 rounded-xl border border-border bg-muted/50 px-3 py-2.5">
          <div className="flex items-center gap-2">
            <Refrigerator className="size-4 text-muted-foreground" aria-hidden />
            <div className="flex flex-col gap-0.5">
              <span className="text-sm font-medium">Save leftovers to pantry</span>
              <span className="text-xs text-muted-foreground">
                Optional. Any remainder goes to your inventory.
              </span>
            </div>
          </div>
          <Checkbox
            id="save-leftovers"
            checked={saveLeftovers}
            onCheckedChange={(v) => setSaveLeftovers(!!v)}
            aria-label="Save leftovers to pantry after cooking"
          />
        </div>

        <SheetFooter className="flex-row gap-2 pt-4">
          <Button variant="outline" className="flex-1" onClick={onClose}>
            Abandon
          </Button>
          <Button
            className="flex-1 gap-1.5"
            onClick={handleFinish}
            disabled={saved}
          >
            {saved ? (
              <>
                <CheckCircle2 className="size-4" aria-hidden />
                Done!
              </>
            ) : (
              <>
                <CheckCircle2 className="size-4" aria-hidden />
                Finish cooking
              </>
            )}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}

// ── Recipe detail screen ───────────────────────────────────────────────────────

type SectionTab = 'dietary' | 'ingredients' | 'instructions'

export const RecipeDetailScreen = () => {
  const [section, setSection] = useState<SectionTab>('ingredients')
  const [cookOpen, setCookOpen] = useState(false)

  const recipe = MOCK_RECIPE
  const isAddon = false // meal recipe in this mock; switch to true to demo addon state

  const SECTION_TABS: Array<{ id: SectionTab; label: string }> = [
    { id: 'dietary', label: 'Dietary' },
    { id: 'ingredients', label: 'Ingredients' },
    { id: 'instructions', label: 'Instructions' },
  ]

  return (
    <CozyShell active="recipes" title="Recipe detail">
      <OnTheFlyCookSheet
        open={cookOpen}
        recipeName={recipe.name}
        onClose={() => setCookOpen(false)}
      />

      <div className="flex flex-col gap-5">
        {/* Hero */}
        <div className="flex h-40 w-full items-center justify-center overflow-hidden rounded-2xl bg-gradient-empty">
          <span className="select-none text-7xl leading-none" aria-label={`${recipe.name} recipe icon`}>
            🌮
          </span>
        </div>

        {/* Title + meta */}
        <div className="flex flex-col gap-3">
          <div className="flex items-start justify-between gap-3">
            <h2 className="text-xl font-semibold tracking-tight">{recipe.name}</h2>
            {/* v2.1 NEW — Cook now entry point */}
            <Button
              onClick={() => setCookOpen(true)}
              className="shrink-0 gap-2"
              aria-label={`Cook ${recipe.name} now`}
            >
              <Play className="size-4" aria-hidden />
              Cook now
            </Button>
          </div>

          {/* "Cook now" framing note */}
          <div className="flex items-start gap-2 rounded-xl border border-success/20 bg-success-tint/30 px-3 py-2">
            <Play className="mt-0.5 size-3.5 shrink-0 text-success" aria-hidden />
            <p className="text-xs text-muted-foreground">
              <span className="font-semibold text-success">On-the-fly cook mode</span> — cook
              this recipe any time without adding it to your weekly menu. The active menu is
              never changed; optionally save leftovers to your pantry when done.
            </p>
          </div>

          {/* Meta chips */}
          <div className="flex flex-wrap gap-2 text-xs font-medium">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1 capitalize text-muted-foreground">
              <UtensilsCrossed className="size-3.5" aria-hidden />
              {recipe.meal}
            </span>
            {isAddon && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-purchase-tint px-3 py-1 text-purchase">
                <Package className="size-3.5" aria-hidden />
                Addon
              </span>
            )}
            {recipe.cuisine && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1 text-muted-foreground">
                {recipe.cuisine}
              </span>
            )}
            <span
              className={cn(
                'inline-flex items-center gap-1.5 rounded-full px-3 py-1 capitalize',
                recipe.difficulty === 'Easy' ? 'bg-success-tint text-success' :
                recipe.difficulty === 'Medium' ? 'bg-warning-tint text-warning' :
                'bg-destructive/10 text-destructive',
              )}
            >
              <Flame className="size-3.5" aria-hidden />
              {recipe.difficulty}
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1 text-muted-foreground">
              <Clock className="size-3.5" aria-hidden />
              {recipe.minutes} min
            </span>
          </div>
        </div>

        {/* Section tabs */}
        <div
          className="flex gap-1 rounded-full border border-border bg-muted/40 p-1"
          role="tablist"
          aria-label="Recipe sections"
        >
          {SECTION_TABS.map((tab) => {
            const isActive = section === tab.id
            return (
              <button
                key={tab.id}
                role="tab"
                type="button"
                aria-selected={isActive}
                onClick={() => setSection(tab.id)}
                className={cn(
                  'flex-1 rounded-full px-3 py-1.5 text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {tab.label}
              </button>
            )
          })}
        </div>

        {/* Section content */}
        <div role="tabpanel" className="flex flex-col gap-3">
          {section === 'dietary' && (
            <div className="flex flex-wrap gap-2">
              {recipe.tags.map((tag) => (
                <span
                  key={tag}
                  className="rounded-full bg-accent-tint px-3 py-1 text-xs font-medium text-accent-strong"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}

          {section === 'ingredients' && (
            <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
              <ul className="flex flex-col divide-y divide-border">
                {MOCK_INGREDIENTS.map((ing, idx) => (
                  <li
                    key={idx}
                    className={cn(
                      'flex items-center gap-3 px-4 py-3 text-sm',
                      idx === 0 && 'rounded-t-2xl',
                      idx === MOCK_INGREDIENTS.length - 1 && 'rounded-b-2xl',
                    )}
                  >
                    <span className="mt-0.5 size-1.5 shrink-0 rounded-full bg-muted-foreground/40" aria-hidden />
                    <span className="flex-1 font-medium">{ing}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {section === 'instructions' && (
            <ol className="flex flex-col gap-3">
              {MOCK_STEPS.map((step, idx) => (
                <li
                  key={idx}
                  className="flex gap-3 rounded-2xl border border-border bg-card p-4 shadow-sm"
                >
                  <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-accent-tint text-sm font-semibold text-accent-strong">
                    {idx + 1}
                  </span>
                  <p className="text-sm leading-relaxed">{step}</p>
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>
    </CozyShell>
  )
}
