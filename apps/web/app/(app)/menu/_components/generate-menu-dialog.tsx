'use client'

import { useEffect, useMemo, useState } from 'react'
import { AlertCircle, Loader2, Sparkles, Wand2 } from 'lucide-react'
import {
  useGenerateMenu,
  type GenerateMenuResponse,
} from '@/lib/hooks/use-generate-menu'
import { useCustomMenu } from '@/lib/hooks/use-custom-menu'
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
import { MultiLabelCombobox } from '@/components/forms/multi-label-combobox'
import { notifyError, notifySuccess } from '@/lib/toast'
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

export const GenerateMenuDialog = ({
  workspaceId,
  open,
  onOpenChange,
  mode,
}: GenerateMenuDialogProps) => {
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

  const autoMutation = useGenerateMenu({ workspaceId })
  const customMutation = useCustomMenu({ workspaceId })
  const isPending = autoMutation.isPending || customMutation.isPending

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
    return Object.keys(out).length > 0 ? out : undefined
  }, [dietaryRestrictions, allergies, frequencyOverrides])

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
              role="tab"
              type="button"
              aria-selected={dialogMode === 'auto'}
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
              role="tab"
              type="button"
              aria-selected={dialogMode === 'custom'}
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

          {dialogMode === 'auto' ? (
            <RecipePreviewPanel workspaceId={workspaceId} />
          ) : null}

          {dialogMode === 'custom' ? (
            <CustomMenuBuilder
              workspaceId={workspaceId}
              weekStartDate={weekStartDate}
              durationDays={durationDays}
              slots={customSlots}
              onChange={setCustomSlots}
            />
          ) : null}

          {failure && !failure.ok ? (
            <div className="flex gap-3 rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm">
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
