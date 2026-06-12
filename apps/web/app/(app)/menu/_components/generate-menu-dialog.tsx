'use client'

import { useEffect, useMemo, useState } from 'react'
import { AlertCircle, ChevronDown, Info, Loader2, Shield, Smile, Sparkles, Wand2, X } from 'lucide-react'
import {
  useGenerateMenu,
  type GenerateMenuResponse,
} from '@/lib/hooks/use-generate-menu'
import { useCustomMenu } from '@/lib/hooks/use-custom-menu'
import { useMembersList } from '@weekly-food-planner/supabase/react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { MultiLabelCombobox } from '@/components/forms/multi-label-combobox'
import { useSupabase } from '@/lib/hooks/use-supabase'
import { notifyError, notifySuccess } from '@/lib/toast'
import { cn } from '@/lib/utils'
import { CustomMenuBuilder, type CustomBuilderSlot } from './custom-menu-builder'
import {
  ParticipantsFrequencyPanel,
  type FrequencyOverrideEntry,
} from './participants-frequency-panel'
import { RecipePreviewPanel } from './recipe-preview-panel'

const formatYmd = (date: Date): string => {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

const today = (): string => formatYmd(new Date())

const reasonLabel = (reasonCode: string): string => {
  switch (reasonCode) {
    case 'NO_CANDIDATES':
      return 'No recipe satisfies one of the slots'
    case 'NO_SLOTS':
      return 'This workspace has no meal frequency'
    case 'ALL_MEALS_PASSED':
      return 'Every meal in this week is already in the past'
    case 'EMPTY_WORKSPACE':
      return 'No recipes yet'
    default:
      return 'Generation failed'
  }
}

type DialogMode = 'auto' | 'custom'

export type GenerateMenuDialogProps = {
  workspaceId: string
  open: boolean
  onOpenChange: (open: boolean) => void
  mode: 'create' | 'regenerate'
}

// ── Per-generation override panel ─────────────────────────────────────────────
// Collapsible per-member override panel — add inclusive prefs, add extra
// exclusive restrictions, relax existing profile restrictions for this run only.
// Wired into the overlay via additionalDietaryPreferences / relaxedDietaryRestrictions
// / relaxedAllergies (RawOverlay fields consumed by computeEffectiveOverlay).

type MemberOverride = {
  additionalPrefs: string[]
  extraRestrictions: string[]
  relaxedRestrictions: Set<string>
  relaxedAllergies: Set<string>
}

const emptyOverride = (): MemberOverride => ({
  additionalPrefs: [],
  extraRestrictions: [],
  relaxedRestrictions: new Set(),
  relaxedAllergies: new Set(),
})

type ChipTagProps = { tag: string; onRemove: ({ tag }: { tag: string }) => void }
const ChipTag = ({ tag, onRemove }: ChipTagProps) => (
  <span className="inline-flex items-center gap-1 rounded-full bg-accent-tint px-2.5 py-1 text-xs font-medium text-accent-strong">
    {tag}
    <button
      type="button"
      onClick={() => onRemove({ tag })}
      aria-label={`Remove ${tag}`}
      className="ml-0.5 rounded-full focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
    >
      <X className="size-3" aria-hidden />
    </button>
  </span>
)

type InlineChipInputProps = {
  value: string[]
  onChange: ({ value }: { value: string[] }) => void
  placeholder: string
}
const InlineChipInput = ({ value, onChange, placeholder }: InlineChipInputProps) => {
  const [input, setInput] = useState('')
  const add = (tag: string) => {
    const t = tag.trim()
    if (!t || value.includes(t)) return
    onChange({ value: [...value, t] })
    setInput('')
  }
  return (
    <div className="flex flex-col gap-1.5">
      {value.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {value.map((t) => (
            <ChipTag
              key={t}
              tag={t}
              onRemove={({ tag }) => onChange({ value: value.filter((v) => v !== tag) })}
            />
          ))}
        </div>
      )}
      <input
        type="text"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add(input) } }}
        onBlur={() => { if (input.trim()) add(input) }}
        placeholder={placeholder}
        className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      />
    </div>
  )
}

type MemberOverridePanelProps = {
  memberId: string
  memberName: string
  restrictions: string[]
  allergies: string[]
  override: MemberOverride
  onChange: ({ memberId, override }: { memberId: string; override: MemberOverride }) => void
}

const MemberOverridePanel = ({
  memberId,
  memberName,
  restrictions,
  allergies,
  override,
  onChange,
}: MemberOverridePanelProps) => {
  const [expanded, setExpanded] = useState(false)

  const toggleRelaxRestriction = (tag: string) => {
    const next = new Set(override.relaxedRestrictions)
    if (next.has(tag)) next.delete(tag)
    else next.add(tag)
    onChange({ memberId, override: { ...override, relaxedRestrictions: next } })
  }

  const toggleRelaxAllergy = (tag: string) => {
    const next = new Set(override.relaxedAllergies)
    if (next.has(tag)) next.delete(tag)
    else next.add(tag)
    onChange({ memberId, override: { ...override, relaxedAllergies: next } })
  }

  const overrideCount =
    override.additionalPrefs.length +
    override.extraRestrictions.length +
    override.relaxedRestrictions.size +
    override.relaxedAllergies.size

  return (
    <div className="flex flex-col gap-0 overflow-hidden rounded-xl border border-border bg-card">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-muted/40 transition text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
      >
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">{memberName}</span>
          {overrideCount > 0 && (
            <Badge variant="outline" className="bg-warning-tint text-warning border-warning/30 text-[10px] px-1.5 py-0">
              {overrideCount} override{overrideCount === 1 ? '' : 's'}
            </Badge>
          )}
        </div>
        <ChevronDown
          className={cn('size-4 text-muted-foreground motion-safe:transition-transform', expanded && 'rotate-180')}
          aria-hidden
        />
      </button>

      {expanded && (
        <div className="flex flex-col gap-4 px-4 pb-4 pt-1">
          {/* "This generation only" banner */}
          <div className="flex items-start gap-2 rounded-lg border border-warning/30 bg-warning-tint/50 px-3 py-2">
            <Info className="mt-0.5 size-3.5 shrink-0 text-warning" aria-hidden />
            <p className="text-xs text-foreground">
              <span className="font-semibold">This generation only.</span> These overrides
              apply once and are not saved to {memberName}&apos;s profile.
            </p>
          </div>

          {/* Add inclusive preferences */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center gap-1.5">
              <Smile className="size-3.5 text-success" aria-hidden />
              <Label className="text-xs font-medium text-success">Add preferences for this generation</Label>
            </div>
            <InlineChipInput
              value={override.additionalPrefs}
              onChange={({ value }) => onChange({ memberId, override: { ...override, additionalPrefs: value } })}
              placeholder="e.g. fish, Mediterranean…"
            />
          </div>

          {/* Add extra exclusive restrictions */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center gap-1.5">
              <Shield className="size-3.5 text-destructive" aria-hidden />
              <Label className="text-xs font-medium text-destructive">Add restrictions for this generation</Label>
            </div>
            <InlineChipInput
              value={override.extraRestrictions}
              onChange={({ value }) => onChange({ memberId, override: { ...override, extraRestrictions: value } })}
              placeholder="e.g. dairy-free, no red meat…"
            />
          </div>

          {/* Relax existing profile restrictions */}
          {(restrictions.length > 0 || allergies.length > 0) && (
            <>
              <Separator />
              <div className="flex flex-col gap-2">
                <Label className="text-xs font-medium">Relax profile restrictions</Label>
                <p className="text-xs text-muted-foreground">
                  Toggle to temporarily lift for this run. Profile is unchanged.
                </p>
                {restrictions.map((r) => {
                  const relaxed = override.relaxedRestrictions.has(r)
                  return (
                    <div
                      key={r}
                      className={cn(
                        'flex items-center justify-between gap-2 rounded-lg border px-3 py-1.5',
                        relaxed ? 'border-warning/30 bg-warning-tint/40' : 'border-border',
                      )}
                    >
                      <div className="flex items-center gap-1.5">
                        <Shield className={cn('size-3 shrink-0', relaxed ? 'text-warning' : 'text-destructive')} aria-hidden />
                        <span className={cn('text-xs', relaxed ? 'line-through text-muted-foreground' : 'font-medium')}>{r}</span>
                        {relaxed && <span className="text-[10px] font-medium text-warning">Relaxed</span>}
                      </div>
                      <button
                        type="button"
                        onClick={() => toggleRelaxRestriction(r)}
                        aria-pressed={relaxed}
                        className={cn(
                          'rounded-full px-2 py-0.5 text-[10px] font-medium transition focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
                          relaxed
                            ? 'bg-warning-tint text-warning'
                            : 'border border-border text-muted-foreground hover:border-destructive/40 hover:text-destructive',
                        )}
                      >
                        {relaxed ? 'Restore' : 'Relax'}
                      </button>
                    </div>
                  )
                })}
                {allergies.map((a) => {
                  const relaxed = override.relaxedAllergies.has(a)
                  return (
                    <div
                      key={a}
                      className={cn(
                        'flex items-center justify-between gap-2 rounded-lg border px-3 py-1.5',
                        relaxed ? 'border-warning/30 bg-warning-tint/40' : 'border-border',
                      )}
                    >
                      <div className="flex items-center gap-1.5">
                        <Shield className={cn('size-3 shrink-0', relaxed ? 'text-warning' : 'text-destructive')} aria-hidden />
                        <span className={cn('text-xs', relaxed ? 'line-through text-muted-foreground' : 'font-medium')}>{a}</span>
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-destructive/30 text-destructive">allergy</Badge>
                        {relaxed && <span className="text-[10px] font-medium text-warning">Relaxed</span>}
                      </div>
                      <button
                        type="button"
                        onClick={() => toggleRelaxAllergy(a)}
                        aria-pressed={relaxed}
                        className={cn(
                          'rounded-full px-2 py-0.5 text-[10px] font-medium transition focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
                          relaxed
                            ? 'bg-warning-tint text-warning'
                            : 'border border-border text-muted-foreground hover:border-destructive/40 hover:text-destructive',
                        )}
                      >
                        {relaxed ? 'Restore' : 'Relax'}
                      </button>
                    </div>
                  )
                })}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}

// ── Dialog ─────────────────────────────────────────────────────────────────────

export const GenerateMenuDialog = ({
  workspaceId,
  open,
  onOpenChange,
  mode,
}: GenerateMenuDialogProps) => {
  const supabase = useSupabase()
  const [dialogMode, setDialogMode] = useState<DialogMode>('auto')
  const [weekStartDate, setWeekStartDate] = useState<string>(() => today())
  const [durationDays, setDurationDays] = useState<number>(7)
  const [dietaryRestrictions, setDietaryRestrictions] = useState<string[]>([])
  const [allergies, setAllergies] = useState<string[]>([])
  const [failure, setFailure] = useState<GenerateMenuResponse | null>(null)
  const [customSlots, setCustomSlots] = useState<CustomBuilderSlot[]>([])
  // null = user hasn't picked → submit as undefined so the server defaults to
  // "every active member". Explicit empty array would be a UX error and the
  // panel's button-toggle UI prevents that path.
  const [participantIds, setParticipantIds] = useState<string[] | null>(null)
  const [frequencyOverrides, setFrequencyOverrides] = useState<
    FrequencyOverrideEntry[]
  >([])
  // (v2.1) Per-member constraint overrides for this generation only.
  const [memberOverrides, setMemberOverrides] = useState<Map<string, MemberOverride>>(
    new Map(),
  )

  // Members list for the override panel — loaded lazily (only when the dialog opens).
  const membersQuery = useMembersList({
    supabase,
    workspaceId,
    enabled: open,
  })
  const members = membersQuery.data ?? []

  const autoMutation = useGenerateMenu({ workspaceId })
  const customMutation = useCustomMenu({ workspaceId })
  const isPending = autoMutation.isPending || customMutation.isPending

  const handleMemberOverrideChange = ({
    memberId,
    override,
  }: {
    memberId: string
    override: MemberOverride
  }) => {
    setMemberOverrides((prev) => {
      const next = new Map(prev)
      next.set(memberId, override)
      return next
    })
  }

  const reset = () => {
    setFailure(null)
    setDialogMode('auto')
    setWeekStartDate(today())
    setDurationDays(7)
    setDietaryRestrictions([])
    setAllergies([])
    setCustomSlots([])
    setParticipantIds(null)
    setFrequencyOverrides([])
    setMemberOverrides(new Map())
  }

  // When the dialog re-opens, reset the form to a fresh state. We do this on
  // every open rather than on close so a previous failure doesn't leak into
  // the next attempt.
  useEffect(() => {
    if (open) {
      setFailure(null)
    }
  }, [open])

  const overlay = useMemo(() => {
    const out: Record<string, unknown> = {}
    if (dietaryRestrictions.length > 0) {
      out.additionalDietaryRestrictions = dietaryRestrictions
    }
    if (allergies.length > 0) out.additionalAllergies = allergies
    if (frequencyOverrides.length > 0) {
      out.memberFrequencyOverrides = frequencyOverrides
    }

    // (v2.1) Merge per-member overrides into the overlay fields.
    // additionalDietaryPreferences, relaxedDietaryRestrictions, relaxedAllergies
    // are flattened across all members and de-duped at the overlay layer
    // (computeEffectiveOverlay handles the rest at the route level).
    const allPrefTags: string[] = []
    const allExtraRestrictions: string[] = []
    const allRelaxedRestrictions: string[] = []
    const allRelaxedAllergies: string[] = []

    for (const override of memberOverrides.values()) {
      for (const tag of override.additionalPrefs) {
        if (!allPrefTags.includes(tag)) allPrefTags.push(tag)
      }
      for (const r of override.extraRestrictions) {
        if (!allExtraRestrictions.includes(r)) allExtraRestrictions.push(r)
      }
      for (const r of override.relaxedRestrictions) {
        if (!allRelaxedRestrictions.includes(r)) allRelaxedRestrictions.push(r)
      }
      for (const a of override.relaxedAllergies) {
        if (!allRelaxedAllergies.includes(a)) allRelaxedAllergies.push(a)
      }
    }

    if (allPrefTags.length > 0) {
      out.additionalDietaryPreferences = { tags: allPrefTags }
    }
    if (allExtraRestrictions.length > 0) {
      const existing = (out.additionalDietaryRestrictions as string[] | undefined) ?? []
      const merged = Array.from(new Set([...existing, ...allExtraRestrictions]))
      out.additionalDietaryRestrictions = merged
    }
    if (allRelaxedRestrictions.length > 0) {
      out.relaxedDietaryRestrictions = allRelaxedRestrictions
    }
    if (allRelaxedAllergies.length > 0) {
      out.relaxedAllergies = allRelaxedAllergies
    }

    return Object.keys(out).length > 0 ? out : undefined
  }, [dietaryRestrictions, allergies, frequencyOverrides, memberOverrides])

  // The server treats `undefined` participantMemberIds as "every active
  // member". Only send an explicit list when the user actually customized
  // the participant set — otherwise we'd lock the menu to whoever was
  // active at request time even if a member is added later.
  const participantsForSubmit = participantIds ?? undefined

  const handleAutoSubmit = async () => {
    setFailure(null)
    try {
      const result = await autoMutation.mutateAsync({
        weekStartDate,
        durationDays,
        options: overlay,
        participantMemberIds: participantsForSubmit,
      })
      if (result.ok) {
        notifySuccess(
          mode === 'create' ? 'Draft menu generated' : 'Draft menu regenerated',
          `Week of ${weekStartDate} · ${durationDays} day${durationDays === 1 ? '' : 's'}`,
        )
        reset()
        onOpenChange(false)
        return
      }
      setFailure(result)
    } catch (err) {
      notifyError(
        'Generation failed',
        err instanceof Error ? err.message : 'Could not reach the menu generator.',
      )
    }
  }

  const handleCustomSubmit = async () => {
    setFailure(null)
    if (customSlots.length === 0) {
      notifyError('Pick at least one meal for your custom menu.')
      return
    }
    try {
      await customMutation.mutateAsync({
        weekStartDate,
        durationDays,
        slots: customSlots,
        options: overlay,
        participantMemberIds: participantsForSubmit,
      })
      notifySuccess(
        'Custom menu draft created',
        `${customSlots.length} meal${customSlots.length === 1 ? '' : 's'} · review before accepting`,
      )
      reset()
      onOpenChange(false)
    } catch (err) {
      notifyError(
        'Custom menu failed',
        err instanceof Error ? err.message : 'Could not create the custom menu.',
      )
    }
  }

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (dialogMode === 'auto') void handleAutoSubmit()
    else void handleCustomSubmit()
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) reset()
        onOpenChange(next)
      }}
    >
      <DialogContent className="max-h-[90vh] w-full max-w-2xl overflow-y-auto">
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>
              {mode === 'create' ? 'Generate a menu' : 'Generate a new draft'}
            </DialogTitle>
            <DialogDescription>
              Auto-generate from the constraint engine, or build a custom menu
              by picking each meal yourself. Either way, the result is a draft
              you can review and edit before accepting.
            </DialogDescription>
          </DialogHeader>

          <div
            className="grid grid-cols-2 gap-1 rounded-full bg-muted p-1"
            role="tablist"
            aria-label="Menu generation mode"
          >
            <button
              id="tab-auto"
              role="tab"
              type="button"
              aria-selected={dialogMode === 'auto'}
              aria-controls="panel-auto"
              onClick={() => setDialogMode('auto')}
              className={`flex items-center justify-center gap-2 rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
                dialogMode === 'auto'
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Sparkles className="size-4" />
              Auto
            </button>
            <button
              id="tab-custom"
              role="tab"
              type="button"
              aria-selected={dialogMode === 'custom'}
              aria-controls="panel-custom"
              onClick={() => setDialogMode('custom')}
              className={`flex items-center justify-center gap-2 rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
                dialogMode === 'custom'
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Wand2 className="size-4" />
              Custom
            </button>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="week_start_date">Start date</Label>
              <Input
                id="week_start_date"
                type="date"
                required
                value={weekStartDate}
                onChange={(event) => setWeekStartDate(event.target.value)}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="duration_days">Duration (days)</Label>
              <Input
                id="duration_days"
                type="number"
                min={1}
                max={7}
                required
                value={durationDays}
                onChange={(event) => {
                  const n = Number.parseInt(event.target.value, 10)
                  if (Number.isFinite(n)) {
                    setDurationDays(Math.max(1, Math.min(7, n)))
                  }
                }}
              />
            </div>
          </div>

          <details className="rounded-xl border border-border bg-card/40 px-3 py-2 text-sm">
            <summary className="cursor-pointer select-none font-medium">
              Cooking for &amp; meal schedule
            </summary>
            <div className="pt-3">
              <ParticipantsFrequencyPanel
                workspaceId={workspaceId}
                participantIds={participantIds}
                onParticipantsChange={setParticipantIds}
                overrides={frequencyOverrides}
                onOverridesChange={setFrequencyOverrides}
              />
            </div>
          </details>

          <details className="rounded-xl border border-border bg-card/40 px-3 py-2 text-sm">
            <summary className="cursor-pointer select-none font-medium">
              Dietary &amp; allergy presets for this menu
            </summary>
            <div className="flex flex-col gap-3 pt-3">
              <p className="text-xs text-muted-foreground">
                Applied on top of every member&apos;s profile constraints.
                Values already on any member&apos;s profile are skipped
                server-side.
              </p>
              <div className="flex flex-col gap-1.5">
                <Label className="text-xs">Dietary restrictions</Label>
                <MultiLabelCombobox
                  enumType="dietary_restriction"
                  value={dietaryRestrictions}
                  onChange={setDietaryRestrictions}
                  placeholder="e.g. vegan, gluten_free"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label className="text-xs">Allergies</Label>
                <MultiLabelCombobox
                  enumType="food_allergy"
                  value={allergies}
                  onChange={setAllergies}
                  placeholder="e.g. peanut, shellfish"
                />
              </div>
            </div>
          </details>

          {/* v2.1 — Per-generation constraint overrides (per-member) */}
          {members.length > 0 && (
            <details className="rounded-xl border border-border bg-card/40 px-3 py-2 text-sm">
              <summary className="cursor-pointer select-none font-medium">
                Per-generation constraint overrides
              </summary>
              <div className="flex flex-col gap-2 pt-3">
                <p className="text-xs text-muted-foreground">
                  Tweak any member&apos;s constraints for this generation only — add
                  preferences, extra restrictions, or temporarily relax a hard restriction.
                  Changes here do not update any member&apos;s saved profile.
                </p>
                {members.map((m) => (
                  <MemberOverridePanel
                    key={m.id}
                    memberId={m.id}
                    memberName={m.name}
                    restrictions={m.member_dietary_restrictions.map((r) => r.restriction)}
                    allergies={m.member_allergies.map((a) => a.allergy)}
                    override={memberOverrides.get(m.id) ?? emptyOverride()}
                    onChange={handleMemberOverrideChange}
                  />
                ))}
              </div>
            </details>
          )}

          {dialogMode === 'auto' ? (
            <div id="panel-auto" role="tabpanel" aria-labelledby="tab-auto" tabIndex={0}>
              <RecipePreviewPanel workspaceId={workspaceId} />
            </div>
          ) : null}

          {dialogMode === 'custom' ? (
            <div id="panel-custom" role="tabpanel" aria-labelledby="tab-custom" tabIndex={0}>
              <CustomMenuBuilder
                workspaceId={workspaceId}
                weekStartDate={weekStartDate}
                durationDays={durationDays}
                slots={customSlots}
                onChange={setCustomSlots}
              />
            </div>
          ) : null}

          {failure && !failure.ok ? (
            <div role="alert" className="flex gap-3 rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm">
              <AlertCircle className="mt-0.5 size-4 shrink-0 text-destructive" />
              <div className="flex flex-col gap-1">
                <p className="font-medium text-destructive">
                  {reasonLabel(failure.error.reasonCode)}
                </p>
                {failure.error.humanMessage ? (
                  <p className="text-muted-foreground">
                    {failure.error.humanMessage}
                  </p>
                ) : null}
                {failure.error.affectedMeal || failure.error.affectedMemberId ? (
                  <p className="text-muted-foreground">
                    Slot{' '}
                    {failure.error.affectedMeal ? (
                      <code className="rounded bg-muted px-1 py-0.5">
                        {failure.error.affectedMeal.day}/
                        {failure.error.affectedMeal.mealKey}
                      </code>
                    ) : null}
                    {failure.error.affectedMemberId
                      ? ` for ${failure.error.affectedMemberName ?? failure.error.affectedMemberId}`
                      : ''}
                  </p>
                ) : null}
              </div>
            </div>
          ) : null}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  {dialogMode === 'auto' ? 'Generating…' : 'Creating…'}
                </>
              ) : dialogMode === 'auto' ? (
                'Generate draft'
              ) : (
                'Create custom draft'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
