'use client'

import { useEffect, useState, type FormEvent } from 'react'
import { Loader2, Plus, Trash2 } from 'lucide-react'
import {
  useUpdateWorkspace,
  useWorkspaceWithMembers,
} from '@weekly-food-planner/supabase/react'
import type { MealFrequencyEntry } from '@weekly-food-planner/supabase'
import { useSupabase } from '@/lib/hooks/use-supabase'
import { useActiveWorkspace } from '@/components/workspace-provider'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { notifyError, notifySuccess } from '@/lib/toast'

const MEAL_TYPES = ['breakfast', 'lunch', 'dinner', 'snack'] as const
type MealType = (typeof MEAL_TYPES)[number]

// Local row shape that mirrors MealFrequencyEntry but treats `defaultHour` as
// a string for input handling. Converted on submit. Each row gets a stable
// React key independent of `key` (which the user may edit) so re-renders
// don't lose focus.
type LocalRow = {
  rowKey: string
  key: string
  title: string
  mealType: MealType
  defaultHour: string
}

const slugify = (input: string): string =>
  input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '') || 'meal'

const DEFAULT_TEMPLATE: MealFrequencyEntry[] = [
  { key: 'breakfast', title: 'Breakfast', mealType: 'breakfast', defaultHour: 8 },
  { key: 'dinner', title: 'Dinner', mealType: 'dinner', defaultHour: 18 },
]

const toLocal = (entries: MealFrequencyEntry[] | null): LocalRow[] => {
  const list = entries && entries.length > 0 ? entries : DEFAULT_TEMPLATE
  return list.map((e, i) => ({
    rowKey: `${e.key}-${i}`,
    key: e.key,
    title: e.title,
    mealType: e.mealType,
    defaultHour: String(e.defaultHour),
  }))
}

let rowCounter = 0
const nextRowKey = (): string => `row-${Date.now()}-${++rowCounter}`

export const MealScheduleCard = () => {
  const supabase = useSupabase()
  const { workspace } = useActiveWorkspace()
  const workspaceQuery = useWorkspaceWithMembers({
    supabase,
    workspaceId: workspace?.id ?? null,
  })

  const [rows, setRows] = useState<LocalRow[]>([])
  const [seeded, setSeeded] = useState(false)

  // One-shot seed when the workspace lands. Subsequent server-side changes
  // are intentionally NOT mirrored back into the form — the user owns the
  // draft state until Save. We track `seeded` so refetches don't clobber.
  useEffect(() => {
    if (!seeded && workspaceQuery.data) {
      setRows(toLocal(workspaceQuery.data.shared_meal_frequency))
      setSeeded(true)
    }
  }, [seeded, workspaceQuery.data])

  const mutation = useUpdateWorkspace({ supabase, workspaceId: workspace?.id ?? '' })

  const updateRow = (rowKey: string, patch: Partial<LocalRow>) => {
    setRows((prev) => prev.map((r) => (r.rowKey === rowKey ? { ...r, ...patch } : r)))
  }

  const removeRow = (rowKey: string) => {
    setRows((prev) => prev.filter((r) => r.rowKey !== rowKey))
  }

  const addRow = () => {
    setRows((prev) => [
      ...prev,
      {
        rowKey: nextRowKey(),
        key: '',
        title: '',
        mealType: 'lunch',
        defaultHour: '12',
      },
    ])
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!workspace) return

    // Validate + normalize. Empty titles drop their rows. Each row's `key` is
    // either user-set or derived from the title; collisions are resolved by
    // appending an index so the engine's per-slot identifier stays unique.
    const seenKeys = new Set<string>()
    const entries: MealFrequencyEntry[] = []
    for (const r of rows) {
      const title = r.title.trim()
      if (title.length === 0) continue
      const hour = Number.parseInt(r.defaultHour, 10)
      if (!Number.isFinite(hour) || hour < 0 || hour > 23) {
        notifyError('Invalid hour', `“${title}” has an hour outside 0–23.`)
        return
      }
      let key = r.key.trim() || slugify(title)
      let suffix = 2
      while (seenKeys.has(key)) {
        key = `${slugify(title)}_${suffix}`
        suffix += 1
      }
      seenKeys.add(key)
      entries.push({ key, title, mealType: r.mealType, defaultHour: hour })
    }

    if (entries.length === 0) {
      notifyError('No meals configured', 'Add at least one meal slot before saving.')
      return
    }

    try {
      await mutation.mutateAsync({ shared_meal_frequency: entries })
      notifySuccess('Meal schedule saved', `${entries.length} slots per day.`)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not save schedule.'
      notifyError('Save failed', message)
    }
  }

  const isLoading = workspaceQuery.isLoading || !workspace

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Meal schedule</CardTitle>
        <CardDescription>
          The week is generated as one slot per day for each row below. New users start with
          breakfast + dinner — adjust to match how you actually eat.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {isLoading ? 'Loading…' : 'No meal slots yet. Add one below.'}
            </p>
          ) : (
            <div className="flex flex-col gap-2">
              {rows.map((row) => (
                <div
                  key={row.rowKey}
                  className="grid grid-cols-[1fr_120px_72px_auto] items-end gap-2 rounded-md border border-border p-3"
                >
                  <div className="flex flex-col gap-1">
                    <Label htmlFor={`title-${row.rowKey}`} className="text-xs">
                      Title
                    </Label>
                    <Input
                      id={`title-${row.rowKey}`}
                      value={row.title}
                      onChange={(event) =>
                        updateRow(row.rowKey, { title: event.target.value })
                      }
                      placeholder="e.g. Breakfast"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <Label className="text-xs">Type</Label>
                    <Select
                      value={row.mealType}
                      onValueChange={(value) =>
                        updateRow(row.rowKey, { mealType: value as MealType })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {MEAL_TYPES.map((m) => (
                          <SelectItem key={m} value={m}>
                            {m}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex flex-col gap-1">
                    <Label htmlFor={`hour-${row.rowKey}`} className="text-xs">
                      Hour
                    </Label>
                    <Input
                      id={`hour-${row.rowKey}`}
                      type="number"
                      min={0}
                      max={23}
                      value={row.defaultHour}
                      onChange={(event) =>
                        updateRow(row.rowKey, { defaultHour: event.target.value })
                      }
                    />
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={`Remove ${row.title || 'meal'}`}
                    onClick={() => removeRow(row.rowKey)}
                    className="text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}

          <div className="flex items-center justify-between">
            <Button type="button" variant="outline" size="sm" onClick={addRow}>
              <Plus className="size-4" />
              Add meal slot
            </Button>
            <Button type="submit" disabled={mutation.isPending || isLoading}>
              {mutation.isPending ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Saving…
                </>
              ) : (
                'Save schedule'
              )}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
