'use client'

import { useState } from 'react'
import { Check, UtensilsCrossed, Package } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { CozyShell } from '../cozy-shell'

// ── Mock constants ────────────────────────────────────────────────────────────

const MEAL_TYPES = ['breakfast', 'lunch', 'dinner', 'snack'] as const
type MealType = (typeof MEAL_TYPES)[number]

const DIFFICULTIES = ['easy', 'medium', 'hard'] as const

// recipe kind: 'meal' shows the meal-type multi-select; 'addon' hides it.
type RecipeKind = 'meal' | 'addon'

// ── Meal-type multi-select (v2.1 Phase 8) ────────────────────────────────────
// Renders as a compact checkbox group — mirrors the MultiLabelCombobox pattern
// but restricted to the four fixed meal-type values (no free-text entry).
// ≥1 required when recipe kind = 'meal'.

const MealTypeMultiSelect = ({
  value,
  onChange,
}: {
  value: MealType[]
  onChange: ({ value }: { value: MealType[] }) => void
}) => {
  const toggle = (meal: MealType) => {
    const next = value.includes(meal)
      ? value.filter((m) => m !== meal)
      : [...value, meal]
    onChange({ value: next })
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-2">
        {MEAL_TYPES.map((meal) => {
          const selected = value.includes(meal)
          const checkboxId = `meal-type-${meal}`
          return (
            <label
              key={meal}
              htmlFor={checkboxId}
              className={cn(
                'inline-flex cursor-pointer items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-medium transition select-none',
                selected
                  ? 'border-transparent bg-accent-tint text-accent-strong'
                  : 'border-border text-muted-foreground hover:bg-muted',
              )}
            >
              <Checkbox
                id={checkboxId}
                checked={selected}
                onCheckedChange={() => toggle(meal)}
                className="sr-only"
                aria-label={`Meal type: ${meal}`}
              />
              {selected && <Check className="size-3 shrink-0" aria-hidden />}
              <span className="capitalize">{meal}</span>
            </label>
          )
        })}
      </div>
      {value.length === 0 && (
        <p className="text-xs font-medium text-destructive" role="alert">
          At least one meal type is required.
        </p>
      )}
    </div>
  )
}

// ── Kind toggle ───────────────────────────────────────────────────────────────
// Two-button segmented toggle — 'meal' vs 'addon'. Toggleing to 'addon' hides
// the meal-type multi-select (addons have no meal-type requirement per §24).

const KindToggle = ({
  value,
  onChange,
}: {
  value: RecipeKind
  onChange: ({ kind }: { kind: RecipeKind }) => void
}) => (
  <div
    className="flex items-center overflow-hidden rounded-full border border-border bg-muted/60 p-0.5"
    role="group"
    aria-label="Recipe kind"
  >
    <button
      type="button"
      onClick={() => onChange({ kind: 'meal' })}
      aria-pressed={value === 'meal'}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-sm font-medium transition',
        value === 'meal'
          ? 'bg-background text-foreground shadow-sm'
          : 'text-muted-foreground hover:text-foreground',
      )}
    >
      <UtensilsCrossed className="size-3.5" aria-hidden />
      Meal
    </button>
    <button
      type="button"
      onClick={() => onChange({ kind: 'addon' })}
      aria-pressed={value === 'addon'}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-sm font-medium transition',
        value === 'addon'
          ? 'bg-background text-foreground shadow-sm'
          : 'text-muted-foreground hover:text-foreground',
      )}
    >
      <Package className="size-3.5" aria-hidden />
      Addon
    </button>
  </div>
)

// ── Shared static form skeleton ───────────────────────────────────────────────
// Renders the "Basics" section with controlled kind + meal-type state.
// Other sections (dietary tags, ingredients, instructions) are static placeholders
// so the mock focuses attention on the two new fields.

const RecipeFormBody = ({
  kind,
  mealTypes,
  onKindChange,
  onMealTypesChange,
}: {
  kind: RecipeKind
  mealTypes: MealType[]
  onKindChange: ({ kind }: { kind: RecipeKind }) => void
  onMealTypesChange: ({ value }: { value: MealType[] }) => void
}) => (
  <div className="flex flex-col gap-5">
    {/* ── Basics section ───────────────────────────────────────────────────── */}
    <section className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-5 shadow-md">
      <h2 className="font-semibold">Basics</h2>
      <div className="grid gap-4 sm:grid-cols-2">
        {/* Name — static placeholder */}
        <div className="sm:col-span-2 flex flex-col gap-1.5">
          <Label htmlFor="mock-name">Name</Label>
          <Input
            id="mock-name"
            placeholder="e.g. Guacamole"
            defaultValue={kind === 'addon' ? 'Guacamole' : 'Chicken Tinga Tostadas'}
            readOnly
          />
        </div>

        {/* v2.1 — Recipe kind toggle (NEW) */}
        <div className="sm:col-span-2 flex flex-col gap-1.5">
          <Label>Recipe kind</Label>
          <KindToggle value={kind} onChange={onKindChange} />
          <p className="text-xs text-muted-foreground">
            {kind === 'meal'
              ? 'Meals fill weekly menu slots and are constraint-engine candidates.'
              : 'Addons (salsa, guac, desserts) accompany meals but are never scheduled by the engine.'}
          </p>
        </div>

        {/* v2.1 — Meal-type multi-select (NEW) — hidden when kind = addon */}
        {kind === 'meal' ? (
          <div className="sm:col-span-2 flex flex-col gap-1.5">
            <Label>
              Meal type
              <span className="ml-1 text-destructive" aria-hidden>*</span>
            </Label>
            <MealTypeMultiSelect
              value={mealTypes}
              onChange={onMealTypesChange}
            />
            <p className="text-xs text-muted-foreground">
              Select every timeframe this recipe is suitable for. A sandwich
              can be breakfast, lunch, or snack.
            </p>
          </div>
        ) : (
          <div className="sm:col-span-2 rounded-xl border border-border bg-muted/40 px-3 py-2.5">
            <p className="text-xs text-muted-foreground">
              <span className="font-medium text-foreground">Addon recipes</span>{' '}
              have no meal-type requirement. They appear in a dedicated
              &ldquo;Addons&rdquo; section in the grocery list.
            </p>
          </div>
        )}

        {/* Difficulty — static */}
        <div className="flex flex-col gap-1.5">
          <Label>Difficulty</Label>
          <Select defaultValue="easy">
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {DIFFICULTIES.map((d) => (
                <SelectItem key={d} value={d}>
                  <span className="capitalize">{d}</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Cuisine — static */}
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="mock-cuisine">Cuisine</Label>
          <Input
            id="mock-cuisine"
            placeholder="e.g. Mexican"
            defaultValue="Mexican"
            readOnly
          />
        </div>
      </div>
    </section>

    {/* ── Dietary tags — static collapsed placeholder ───────────────────────── */}
    <section className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-5 shadow-md opacity-60">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">Dietary tags</h2>
        <Badge variant="outline" className="text-xs">
          collapsed in mock
        </Badge>
      </div>
      <p className="text-sm text-muted-foreground">
        MultiLabelCombobox for dietary_tag (same as current form — unchanged).
      </p>
    </section>

    {/* ── Ingredients — static collapsed placeholder ────────────────────────── */}
    <section className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-5 shadow-md opacity-60">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">Ingredients</h2>
        <Badge variant="outline" className="text-xs">
          collapsed in mock
        </Badge>
      </div>
      <p className="text-sm text-muted-foreground">
        IngredientPicker rows (same as current form — unchanged).
      </p>
    </section>

    {/* ── Footer ───────────────────────────────────────────────────────────── */}
    <div className="flex items-center justify-end gap-2">
      <Button type="button" variant="outline">
        Cancel
      </Button>
      <Button type="button" disabled={kind === 'meal' && mealTypes.length === 0}>
        {kind === 'meal' ? 'Create recipe' : 'Create addon'}
      </Button>
    </div>
  </div>
)

// ── Screen (interactive — toggleable between states) ──────────────────────────
export const RecipeFormScreen = () => {
  const [kind, setKind] = useState<RecipeKind>('meal')
  const [mealTypes, setMealTypes] = useState<MealType[]>(['lunch'])

  return (
    <CozyShell active="recipes" title="New recipe">
      <div className="flex flex-col gap-4">
        {/* State switcher header */}
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-muted/50 px-4 py-3">
          <p className="text-xs text-muted-foreground flex-1">
            <span className="font-medium text-foreground">v2.1 mock</span> — toggle the
            kind to see both states. The multi-select appears only when kind=meal (≥1
            required).
          </p>
          <div
            className="flex items-center overflow-hidden rounded-full border border-border bg-background p-0.5"
            role="group"
            aria-label="Preview state"
          >
            <button
              type="button"
              onClick={() => setKind('meal')}
              aria-pressed={kind === 'meal'}
              className={cn(
                'rounded-full px-3 py-1 text-xs font-medium transition',
                kind === 'meal' ? 'bg-accent-tint text-accent-strong' : 'text-muted-foreground',
              )}
            >
              Meal state
            </button>
            <button
              type="button"
              onClick={() => setKind('addon')}
              aria-pressed={kind === 'addon'}
              className={cn(
                'rounded-full px-3 py-1 text-xs font-medium transition',
                kind === 'addon' ? 'bg-accent-tint text-accent-strong' : 'text-muted-foreground',
              )}
            >
              Addon state
            </button>
          </div>
        </div>

        {/* The form — fully interactive kind toggle + meal-type checkboxes */}
        <RecipeFormBody
          kind={kind}
          mealTypes={mealTypes}
          onKindChange={({ kind: k }) => setKind(k)}
          onMealTypesChange={({ value }) => setMealTypes(value)}
        />
      </div>
    </CozyShell>
  )
}
