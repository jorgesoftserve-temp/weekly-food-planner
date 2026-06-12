'use client'

import { useState } from 'react'
import { Info, Shield, Smile } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { CozyShell } from '../cozy-shell'
import { MOCK_MEMBERS } from '../mock-data'

// ── Mock constraint data ──────────────────────────────────────────────────────

const MOCK_HARD_RESTRICTIONS = ['Vegetarian']
const MOCK_ALLERGIES = ['Peanuts']

// v2.1 — inclusive dietary preferences (soft, "prefers X")
// These are stored in member_dietary_preferences and bias the engine without
// ever excluding a recipe (§22 / Track C).
const MOCK_INCLUSIVE_PREFS = ['Fish', 'Mediterranean']

// All available tags for the mock combobox suggestions
const MOCK_TAG_SUGGESTIONS = [
  'Fish', 'Mediterranean', 'High protein', 'Low carb', 'Spicy', 'Comfort food',
  'Quick meals', 'Seasonal', 'Whole foods',
]

// ── Inline multi-tag selector (mock-only, not wired to real data) ─────────────
// In the live app this will be `MultiLabelCombobox` with enumType="dietary_tag".
// For the mock we inline a simplified chip + suggestion list so the layout is
// accurate without pulling in the real combobox (which needs a Supabase client).

type TagPickerProps = {
  value: string[]
  onChange: ({ value }: { value: string[] }) => void
  placeholder?: string
  suggestions?: string[]
}

const MockTagPicker = ({
  value,
  onChange,
  placeholder = 'Add a tag...',
  suggestions = MOCK_TAG_SUGGESTIONS,
}: TagPickerProps) => {
  const [inputVal, setInputVal] = useState('')
  const [focused, setFocused] = useState(false)

  const toggle = (tag: string) => {
    const next = value.includes(tag) ? value.filter((t) => t !== tag) : [...value, tag]
    onChange({ value: next })
  }

  const filtered = suggestions.filter(
    (s) => !value.includes(s) && s.toLowerCase().includes(inputVal.toLowerCase()),
  )

  return (
    <div className="flex flex-col gap-2">
      {/* Selected chips */}
      {value.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {value.map((tag) => (
            <button
              key={tag}
              type="button"
              onClick={() => toggle(tag)}
              className="inline-flex items-center gap-1 rounded-full bg-accent-tint px-2.5 py-1 text-xs font-medium text-accent-strong transition hover:bg-accent-tint/70"
              aria-label={`Remove ${tag}`}
            >
              {tag}
              <span aria-hidden className="ml-0.5 font-bold">×</span>
            </button>
          ))}
        </div>
      )}
      {/* Input */}
      <div className="relative">
        <input
          type="text"
          value={inputVal}
          onChange={(e) => setInputVal(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setTimeout(() => setFocused(false), 150)}
          placeholder={placeholder}
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
        {/* Suggestion dropdown */}
        {focused && filtered.length > 0 && (
          <div className="absolute top-full z-10 mt-1 w-full overflow-hidden rounded-xl border border-border bg-popover shadow-md">
            {filtered.slice(0, 6).map((s) => (
              <button
                key={s}
                type="button"
                onMouseDown={() => {
                  toggle(s)
                  setInputVal('')
                }}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-muted"
              >
                {s}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Constraint section wrapper ────────────────────────────────────────────────
// Hard restrictions use a red/destructive tint; inclusive preferences use a
// success/moss tint so the visual distinction communicates soft vs hard at a
// glance. The icon + legend row makes the semantics explicit.

type ConstraintSectionProps = {
  kind: 'hard' | 'inclusive'
  label: string
  description: string
  value: string[]
  onChange: ({ value }: { value: string[] }) => void
  placeholder?: string
  suggestions?: string[]
}

const ConstraintSection = ({
  kind,
  label,
  description,
  value,
  onChange,
  placeholder,
  suggestions,
}: ConstraintSectionProps) => {
  const isHard = kind === 'hard'
  return (
    <div
      className={cn(
        'flex flex-col gap-3 rounded-xl border p-4',
        isHard
          ? 'border-destructive/20 bg-destructive/5'
          : 'border-success/20 bg-success-tint/30',
      )}
    >
      {/* Header */}
      <div className="flex items-start gap-2">
        <div
          className={cn(
            'mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full',
            isHard ? 'bg-destructive/15 text-destructive' : 'bg-success-tint text-success',
          )}
          aria-hidden
        >
          {isHard ? <Shield className="size-3" /> : <Smile className="size-3" />}
        </div>
        <div className="flex flex-col gap-0.5">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold">{label}</span>
            <Badge
              variant="outline"
              className={cn(
                'text-[10px] px-1.5 py-0',
                isHard
                  ? 'border-destructive/30 bg-destructive/10 text-destructive'
                  : 'border-success/30 bg-success-tint text-success',
              )}
            >
              {isHard ? 'Hard — never included' : 'Soft — prefers, never excludes'}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
      </div>
      {/* Picker */}
      <MockTagPicker
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        suggestions={suggestions}
      />
    </div>
  )
}

// ── Screen ────────────────────────────────────────────────────────────────────
export const MemberProfileScreen = () => {
  const member = MOCK_MEMBERS[0]!
  const [restrictions, setRestrictions] = useState<string[]>(MOCK_HARD_RESTRICTIONS)
  const [allergies, setAllergies] = useState<string[]>(MOCK_ALLERGIES)
  const [inclusivePrefs, setInclusivePrefs] = useState<string[]>(MOCK_INCLUSIVE_PREFS)

  return (
    <TooltipProvider>
      <CozyShell active="members" title="Edit member">
        <div className="flex flex-col gap-5">
          {/* Header */}
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex size-14 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white"
              style={{ backgroundColor: `hsl(${Object.entries({ strawberry: '351 79% 56%', moss: '114 38% 45%', teal: '159 35% 40%', amber: '38 80% 44%', ocean: '205 75% 43%', plum: '285 45% 48%' })[0]![1]})` }}>
              {member.initials}
            </div>
            <div className="flex flex-col gap-0.5">
              <h2 className="text-base font-semibold">{member.name}</h2>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-xs capitalize">
                  {member.role}
                </Badge>
                <span className="text-xs text-muted-foreground capitalize">
                  {member.ageCategory}
                </span>
              </div>
            </div>
          </div>

          {/* Basics — static */}
          <section className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-5 shadow-md">
            <h2 className="font-semibold">Basics</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2 flex flex-col gap-1.5">
                <Label>Name</Label>
                <Input defaultValue={member.name} readOnly />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>Age category</Label>
                <Select defaultValue={member.ageCategory.toLowerCase()}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {['infant','toddler','child','teen','adult','senior'].map((a) => (
                      <SelectItem key={a} value={a}>
                        <span className="capitalize">{a}</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </section>

          {/* Dietary profile section */}
          <section className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-5 shadow-md">
            <div className="flex items-start gap-2">
              <div className="flex flex-col gap-0.5">
                <h2 className="font-semibold">Dietary profile</h2>
                <p className="text-sm text-muted-foreground">
                  Hard restrictions and allergies are never violated. Inclusive
                  preferences bias the engine without excluding anything.
                </p>
              </div>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button type="button" aria-label="Learn about preference modes" className="mt-0.5 text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded">
                    <Info className="size-4" aria-hidden />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="left" className="max-w-xs text-xs">
                  <strong>Hard restrictions</strong> (red) remove all non-compliant
                  recipes from the engine&#39;s candidate set — they can never appear.
                  <br /><br />
                  <strong>Inclusive preferences</strong> (green) add a soft bias: the
                  engine <em>prefers</em> matching recipes but falls back to any valid
                  recipe when none match.
                </TooltipContent>
              </Tooltip>
            </div>

            <div className="flex flex-col gap-4">
              {/* Hard: dietary restrictions */}
              <ConstraintSection
                kind="hard"
                label="Dietary restrictions"
                description="Applied to every recipe the engine picks for this member. The engine never selects a recipe that violates these."
                value={restrictions}
                onChange={({ value }) => setRestrictions(value)}
                placeholder="Add a restriction (vegetarian, gluten-free…)"
                suggestions={['Vegetarian', 'Vegan', 'Gluten-free', 'Dairy-free', 'Keto', 'Halal', 'Kosher']}
              />

              {/* Hard: allergies */}
              <ConstraintSection
                kind="hard"
                label="Allergies"
                description="Hard-filters any recipe whose ingredients carry a matching allergen."
                value={allergies}
                onChange={({ value }) => setAllergies(value)}
                placeholder="Add an allergy (peanuts, shellfish…)"
                suggestions={['Peanuts', 'Tree nuts', 'Shellfish', 'Dairy', 'Eggs', 'Soy', 'Wheat']}
              />

              <Separator />

              {/* v2.1 NEW — inclusive preferences */}
              <ConstraintSection
                kind="inclusive"
                label="Food preferences"
                description="Tags or ingredients this member enjoys. The engine biases toward matching recipes but always falls back to valid options — nothing is excluded."
                value={inclusivePrefs}
                onChange={({ value }) => setInclusivePrefs(value)}
                placeholder="Add a preference (fish, spicy, Mediterranean…)"
                suggestions={MOCK_TAG_SUGGESTIONS}
              />
            </div>

            {/* Legend */}
            <div className="flex flex-wrap items-center gap-4 rounded-xl border border-border bg-muted/40 px-3 py-2">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <span className="flex size-3 shrink-0 items-center justify-center rounded-full bg-destructive/20" aria-hidden>
                  <Shield className="size-2 text-destructive" />
                </span>
                Hard — never included in engine output
              </div>
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <span className="flex size-3 shrink-0 items-center justify-center rounded-full bg-success-tint" aria-hidden>
                  <Smile className="size-2 text-success" />
                </span>
                Soft — preferred, never forces exclusion
              </div>
            </div>
          </section>

          {/* Footer */}
          <div className="flex items-center justify-end gap-2">
            <Button type="button" variant="outline">Cancel</Button>
            <Button type="button">Save changes</Button>
          </div>
        </div>
      </CozyShell>
    </TooltipProvider>
  )
}
