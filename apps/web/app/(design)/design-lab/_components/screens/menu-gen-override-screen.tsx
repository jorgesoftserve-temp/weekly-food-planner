'use client'

import { useState } from 'react'
import { ChevronDown, Info, Shield, Smile, Sparkles, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { CozyShell } from '../cozy-shell'
import { MOCK_MEMBERS, memberAccentStyle, memberDotStyle } from '../mock-data'

// ── Mock data ─────────────────────────────────────────────────────────────────

// Jorge's profile hard restrictions (the ones the user can "relax" for this run)
const JORGE_HARD_RESTRICTIONS = ['Vegetarian']
const JORGE_ALLERGIES = ['Peanuts']

const PREFERENCE_SUGGESTIONS = [
  'Fish', 'Mediterranean', 'High protein', 'Spicy', 'Comfort food',
  'Low carb', 'Quick meals', 'Seafood',
]
const EXTRA_RESTRICTION_SUGGESTIONS = [
  'Dairy-free', 'Gluten-free', 'No red meat', 'Low sodium', 'No shellfish',
]

// ── Minimal chip-based tag input ─────────────────────────────────────────────

type ChipInputProps = {
  value: string[]
  onChange: ({ value }: { value: string[] }) => void
  placeholder: string
  suggestions?: string[]
}

const ChipInput = ({ value, onChange, placeholder, suggestions = [] }: ChipInputProps) => {
  const [input, setInput] = useState('')
  const [open, setOpen] = useState(false)

  const add = (tag: string) => {
    const trimmed = tag.trim()
    if (!trimmed || value.includes(trimmed)) return
    onChange({ value: [...value, trimmed] })
    setInput('')
  }

  const remove = (tag: string) => onChange({ value: value.filter((t) => t !== tag) })

  const filtered = suggestions.filter(
    (s) => !value.includes(s) && s.toLowerCase().includes(input.toLowerCase()),
  )

  return (
    <div className="flex flex-col gap-2">
      {value.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {value.map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center gap-1 rounded-full bg-accent-tint px-2.5 py-1 text-xs font-medium text-accent-strong"
            >
              {tag}
              <button
                type="button"
                onClick={() => remove(tag)}
                aria-label={`Remove ${tag}`}
                className="ml-0.5 rounded-full focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                <X className="size-3" aria-hidden />
              </button>
            </span>
          ))}
        </div>
      )}
      <div className="relative">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add(input) } }}
          placeholder={placeholder}
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
        {open && filtered.length > 0 && (
          <div className="absolute top-full z-10 mt-1 w-full overflow-hidden rounded-xl border border-border bg-popover shadow-md">
            {filtered.slice(0, 5).map((s) => (
              <button
                key={s}
                type="button"
                onMouseDown={() => { add(s); setInput('') }}
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

// ── Relax-restriction toggle row ──────────────────────────────────────────────
// Each profile hard restriction shows as a pill the user can "relax" (cross out)
// for this generation only. Relaxed restrictions are visually struck-through and
// carry a "Relaxed for this run" label. This flows into the engine overlay as
// `relaxedDietaryRestrictions` / `relaxedAllergies`.
//
// FLAG for design-system-architect: the "relaxed" state uses the warning tint to
// signal a temporary lift. No new token needed — --warning-tint / --warning work.

type RelaxableConstraintProps = {
  tag: string
  kind: 'restriction' | 'allergy'
  relaxed: boolean
  onToggle: ({ tag }: { tag: string }) => void
}

const RelaxableConstraint = ({ tag, kind, relaxed, onToggle }: RelaxableConstraintProps) => (
  <div
    className={cn(
      'flex items-center justify-between gap-3 rounded-lg border px-3 py-2 transition',
      relaxed
        ? 'border-warning/30 bg-warning-tint/40'
        : 'border-border bg-background',
    )}
  >
    <div className="flex items-center gap-2">
      <Shield
        className={cn('size-3.5 shrink-0', relaxed ? 'text-warning' : 'text-destructive')}
        aria-hidden
      />
      <span
        className={cn(
          'text-sm',
          relaxed ? 'text-muted-foreground line-through' : 'text-foreground font-medium',
        )}
      >
        {tag}
      </span>
      {kind === 'allergy' && (
        <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-destructive/30 text-destructive">
          allergy
        </Badge>
      )}
      {relaxed && (
        <span className="text-xs font-medium text-warning">
          Relaxed for this run
        </span>
      )}
    </div>
    <button
      type="button"
      onClick={() => onToggle({ tag })}
      aria-pressed={relaxed}
      className={cn(
        'rounded-full px-2.5 py-0.5 text-xs font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        relaxed
          ? 'bg-warning-tint text-warning hover:bg-warning-tint/70'
          : 'border border-border text-muted-foreground hover:text-destructive hover:border-destructive/40',
      )}
    >
      {relaxed ? 'Restore' : 'Relax'}
    </button>
  </div>
)

// ── Per-generation override panel ─────────────────────────────────────────────
// The "this generation only" panel is collapsible — collapsed by default so the
// primary CTA stays visible.

type OverridePanelProps = {
  memberId: string
}

const OverridePanel = ({ memberId }: OverridePanelProps) => {
  const [expanded, setExpanded] = useState(true)
  const [additionalPrefs, setAdditionalPrefs] = useState<string[]>(['Fish'])
  const [extraRestrictions, setExtraRestrictions] = useState<string[]>([])
  const [relaxedRestrictions, setRelaxedRestrictions] = useState<Set<string>>(new Set())

  const member = MOCK_MEMBERS.find((m) => m.id === memberId)
  if (!member) return null

  const toggleRelax = ({ tag }: { tag: string }) => {
    setRelaxedRestrictions((prev) => {
      const next = new Set(prev)
      if (next.has(tag)) next.delete(tag)
      else next.add(tag)
      return next
    })
  }

  const overrideCount =
    additionalPrefs.length + extraRestrictions.length + relaxedRestrictions.size

  return (
    <div className="flex flex-col gap-0 overflow-hidden rounded-2xl border border-border bg-card shadow-md">
      {/* Collapsible header */}
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        className="flex items-center justify-between gap-3 px-5 py-3.5 hover:bg-muted/40 transition"
      >
        <div className="flex items-center gap-2.5">
          {/* Member chip */}
          <span
            className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium"
            style={memberAccentStyle(member.accent)}
          >
            <span className="size-1.5 rounded-full" aria-hidden style={memberDotStyle(member.accent)} />
            {member.name.split(' ')[0]}
          </span>
          <span className="text-sm font-medium">Overrides for this generation</span>
          {overrideCount > 0 && (
            <Badge variant="outline" className="bg-warning-tint text-warning border-warning/30 text-xs">
              {overrideCount} active
            </Badge>
          )}
        </div>
        <ChevronDown
          className={cn('size-4 text-muted-foreground transition-transform', expanded && 'rotate-180')}
          aria-hidden
        />
      </button>

      {expanded && (
        <div className="flex flex-col gap-5 px-5 pb-5 pt-2">
          {/* "This generation only" framing banner */}
          <div className="flex items-start gap-2 rounded-xl border border-warning/30 bg-warning-tint/50 px-3 py-2.5">
            <Info className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden />
            <p className="text-xs text-foreground">
              <span className="font-semibold">This generation only.</span> These overrides are
              applied once and discarded after the menu is generated. They are reflected in the
              generation hash but do not update {member.name.split(' ')[0]}&#39;s saved profile.
            </p>
          </div>

          {/* Add inclusive preferences */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-1.5">
              <Smile className="size-3.5 text-success" aria-hidden />
              <Label className="text-sm font-medium text-success">
                Add preferences for this generation
              </Label>
            </div>
            <p className="text-xs text-muted-foreground">
              Bias the engine toward these tags or ingredients without excluding anything.
            </p>
            <ChipInput
              value={additionalPrefs}
              onChange={({ value }) => setAdditionalPrefs(value)}
              placeholder="e.g. fish, Mediterranean, spicy…"
              suggestions={PREFERENCE_SUGGESTIONS}
            />
          </div>

          <Separator />

          {/* Add extra exclusive restrictions */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-1.5">
              <Shield className="size-3.5 text-destructive" aria-hidden />
              <Label className="text-sm font-medium text-destructive">
                Add restrictions for this generation
              </Label>
            </div>
            <p className="text-xs text-muted-foreground">
              Hard-exclude additional tags from this run only (e.g. going dairy-free just this week).
            </p>
            <ChipInput
              value={extraRestrictions}
              onChange={({ value }) => setExtraRestrictions(value)}
              placeholder="e.g. dairy-free, no red meat…"
              suggestions={EXTRA_RESTRICTION_SUGGESTIONS}
            />
          </div>

          <Separator />

          {/* Relax existing profile restrictions */}
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <Label className="text-sm font-medium">Relax profile restrictions</Label>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button type="button" aria-label="How relaxing restrictions works" className="text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring rounded">
                    <Info className="size-3.5" aria-hidden />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right" className="max-w-xs text-xs">
                  Temporarily lift a hard restriction so the engine can pick recipes that
                  would normally be excluded. This run only — the profile is unchanged.
                </TooltipContent>
              </Tooltip>
            </div>
            <p className="text-xs text-muted-foreground">
              Profile hard restrictions for {member.name.split(' ')[0]}. Toggle any to lift it for
              this generation.
            </p>
            <div className="flex flex-col gap-2">
              {JORGE_HARD_RESTRICTIONS.map((r) => (
                <RelaxableConstraint
                  key={r}
                  tag={r}
                  kind="restriction"
                  relaxed={relaxedRestrictions.has(r)}
                  onToggle={toggleRelax}
                />
              ))}
              {JORGE_ALLERGIES.map((a) => (
                <RelaxableConstraint
                  key={a}
                  tag={a}
                  kind="allergy"
                  relaxed={relaxedRestrictions.has(a)}
                  onToggle={toggleRelax}
                />
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Screen ─────────────────────────────────────────────────────────────────────
export const MenuGenOverrideScreen = () => {
  const [selectedMember, setSelectedMember] = useState('m1')

  return (
    <TooltipProvider>
      <CozyShell active="menu" title="Generate weekly menu">
        <div className="flex flex-col gap-5">
          {/* Page header */}
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex flex-col gap-0.5">
              <h2 className="text-base font-semibold">Generate menu</h2>
              <p className="text-sm text-muted-foreground">
                Review settings and override constraints for this generation only.
              </p>
            </div>
            <Badge variant="outline" className="bg-muted text-muted-foreground text-xs">
              Week of Jun 9
            </Badge>
          </div>

          {/* Static — week + seed (context only) */}
          <section className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-5 shadow-md">
            <h2 className="font-semibold">Generation settings</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="flex flex-col gap-1">
                <span className="text-xs font-medium text-muted-foreground">Week</span>
                <span className="text-sm font-medium">Jun 9 – Jun 15, 2026</span>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-xs font-medium text-muted-foreground">Members included</span>
                <div className="flex flex-wrap gap-1.5">
                  {MOCK_MEMBERS.map((m) => (
                    <span
                      key={m.id}
                      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium"
                      style={memberAccentStyle(m.accent)}
                    >
                      <span className="size-1.5 rounded-full" aria-hidden style={memberDotStyle(m.accent)} />
                      {m.name.split(' ')[0]}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </section>

          {/* v2.1 NEW — per-generation override panel ────────────────────── */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold">Per-generation constraint overrides</h2>
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-warning-tint text-warning border-warning/30">
                v2.1 new
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              Tweak any member&#39;s constraints for this generation only — add
              preferences, add extra restrictions, or temporarily relax a profile
              hard restriction. None of these changes save back to the member&#39;s profile.
            </p>

            {/* Member selector */}
            <div className="flex flex-wrap gap-2" role="group" aria-label="Select member to override">
              {MOCK_MEMBERS.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setSelectedMember(m.id)}
                  aria-pressed={selectedMember === m.id}
                  className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm font-medium transition"
                  style={selectedMember === m.id ? memberAccentStyle(m.accent) : undefined}
                >
                  <span className="size-2 rounded-full" aria-hidden style={memberDotStyle(m.accent)} />
                  {m.name.split(' ')[0]}
                </button>
              ))}
            </div>

            {/* Override panel for selected member */}
            <OverridePanel memberId={selectedMember} />
          </div>

          {/* Generate CTA */}
          <div className="flex items-center justify-end gap-3">
            <Button type="button" variant="outline">Cancel</Button>
            <Button type="button" className="gap-2">
              <Sparkles className="size-4" aria-hidden />
              Generate menu
            </Button>
          </div>
        </div>
      </CozyShell>
    </TooltipProvider>
  )
}
