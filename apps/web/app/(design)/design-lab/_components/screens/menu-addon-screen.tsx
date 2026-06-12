'use client'

import { useState } from 'react'
import {
  CalendarDays,
  Check,
  Package,
  Plus,
  Search,
  Trash2,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { CozyShell } from '../cozy-shell'
import {
  type MealKey,
  MEALS,
  MOCK_WEEK,
} from '../mock-data'

// ── Mock addon recipes ─────────────────────────────────────────────────────────
// In the live app these come from GET /recipes?kind=addon. Here they're static.

type MockAddon = {
  id: string
  name: string
  emoji: string
  description: string
  minutes: number
}

const MOCK_ADDONS: MockAddon[] = [
  { id: 'a1', name: 'Guacamole', emoji: '🥑', description: 'Creamy avocado dip with lime & cilantro', minutes: 10 },
  { id: 'a2', name: 'Salsa roja', emoji: '🍅', description: 'Blended tomato salsa, lightly charred', minutes: 15 },
  { id: 'a3', name: 'Pico de gallo', emoji: '🌿', description: 'Fresh chopped tomato, onion & jalapeño', minutes: 8 },
  { id: 'a4', name: 'Crema agria', emoji: '🥛', description: 'Whipped sour cream with a pinch of salt', minutes: 2 },
  { id: 'a5', name: 'Tres leches slice', emoji: '🍰', description: 'Light sponge soaked in three milks', minutes: 0 },
]

// ── Attached addon record ──────────────────────────────────────────────────────

type AttachScope =
  | { kind: 'week' }
  | { kind: 'slot'; day: string; meal: MealKey }

type AttachedAddon = {
  id: string
  addon: MockAddon
  scope: AttachScope
}

const scopeLabel = (scope: AttachScope): string => {
  if (scope.kind === 'week') return 'Week-wide'
  return `${scope.day} ${scope.meal}`
}

// ── Addon picker sheet ────────────────────────────────────────────────────────
// Lists addon recipes with a search input; selecting one calls onAttach.
// Scope (week-wide vs slot) is chosen inside the sheet before confirming.

type AddonPickerSheetProps = {
  open: boolean
  onClose: () => void
  onAttach: ({ addon, scope }: { addon: MockAddon; scope: AttachScope }) => void
  existingAddonIds: string[]
}

const AddonPickerSheet = ({ open, onClose, onAttach, existingAddonIds }: AddonPickerSheetProps) => {
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<MockAddon | null>(null)
  const [scopeKind, setScopeKind] = useState<'week' | 'slot'>('week')
  const [scopeDay, setScopeDay] = useState('Tue')
  const [scopeMeal, setScopeMeal] = useState<MealKey>('Lunch')

  const filtered = MOCK_ADDONS.filter(
    (a) =>
      !existingAddonIds.includes(a.id) &&
      a.name.toLowerCase().includes(search.toLowerCase()),
  )

  const handleAttach = () => {
    if (!selected) return
    const scope: AttachScope =
      scopeKind === 'week'
        ? { kind: 'week' }
        : { kind: 'slot', day: scopeDay, meal: scopeMeal }
    onAttach({ addon: selected, scope })
    setSelected(null)
    setSearch('')
    onClose()
  }

  return (
    <Sheet open={open} onOpenChange={(v) => { if (!v) onClose() }}>
      <SheetContent side="right" className="flex w-full flex-col gap-0 sm:max-w-md">
        <SheetHeader className="pb-4">
          <SheetTitle>Attach addon</SheetTitle>
          <SheetDescription>
            Pick an addon recipe and choose whether it applies to the whole week
            or a specific meal slot.
          </SheetDescription>
        </SheetHeader>

        {/* Search */}
        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search addon recipes…"
            className="w-full rounded-lg border border-border bg-background py-2 pl-9 pr-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label="Search addon recipes"
          />
        </div>

        {/* Addon list */}
        <div className="flex flex-1 flex-col gap-1 overflow-y-auto">
          {filtered.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">
              No addons found. Create one under Recipes → kind=addon.
            </p>
          ) : (
            filtered.map((addon) => {
              const isSelected = selected?.id === addon.id
              return (
                <button
                  key={addon.id}
                  type="button"
                  onClick={() => setSelected(isSelected ? null : addon)}
                  aria-pressed={isSelected}
                  className={cn(
                    'flex items-start gap-3 rounded-xl border px-3 py-2.5 text-left transition',
                    isSelected
                      ? 'border-accent-strong/30 bg-accent-tint/40'
                      : 'border-border bg-background hover:bg-muted',
                  )}
                >
                  <span className="text-2xl leading-none mt-0.5" aria-hidden>{addon.emoji}</span>
                  <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="text-sm font-medium">{addon.name}</span>
                    <span className="text-xs text-muted-foreground">{addon.description}</span>
                    {addon.minutes > 0 && (
                      <span className="text-xs text-muted-foreground">{addon.minutes} min</span>
                    )}
                  </div>
                  {isSelected && (
                    <Check className="mt-1 size-4 shrink-0 text-accent-strong" aria-hidden />
                  )}
                </button>
              )
            })
          )}
        </div>

        {/* Scope picker — shown when an addon is selected */}
        {selected && (
          <div className="mt-4 flex flex-col gap-3 rounded-xl border border-border bg-muted/50 p-3">
            <p className="text-xs font-medium text-muted-foreground">
              Attach <strong className="text-foreground">{selected.name}</strong> to:
            </p>

            {/* Week-wide vs slot */}
            <div
              className="flex overflow-hidden rounded-full border border-border bg-muted/60 p-0.5"
              role="group"
              aria-label="Attach scope"
            >
              <button
                type="button"
                onClick={() => setScopeKind('week')}
                aria-pressed={scopeKind === 'week'}
                className={cn(
                  'flex flex-1 items-center justify-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium transition',
                  scopeKind === 'week' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground',
                )}
              >
                <CalendarDays className="size-3.5" aria-hidden />
                Week-wide
              </button>
              <button
                type="button"
                onClick={() => setScopeKind('slot')}
                aria-pressed={scopeKind === 'slot'}
                className={cn(
                  'flex flex-1 items-center justify-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium transition',
                  scopeKind === 'slot' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground',
                )}
              >
                <Package className="size-3.5" aria-hidden />
                Specific slot
              </button>
            </div>

            {/* Slot picker */}
            {scopeKind === 'slot' && (
              <div className="flex flex-wrap gap-2">
                {/* Day */}
                <div className="flex flex-col gap-1">
                  <span className="text-[10px] font-medium text-muted-foreground">Day</span>
                  <div className="flex gap-1">
                    {MOCK_WEEK.map(({ day }) => (
                      <button
                        key={day}
                        type="button"
                        onClick={() => setScopeDay(day)}
                        aria-pressed={scopeDay === day}
                        className={cn(
                          'rounded-full px-2.5 py-1 text-xs font-medium transition',
                          scopeDay === day
                            ? 'bg-accent-tint text-accent-strong'
                            : 'border border-border text-muted-foreground hover:bg-muted',
                        )}
                      >
                        {day}
                      </button>
                    ))}
                  </div>
                </div>
                {/* Meal */}
                <div className="flex flex-col gap-1">
                  <span className="text-[10px] font-medium text-muted-foreground">Meal</span>
                  <div className="flex gap-1">
                    {MEALS.map((meal) => (
                      <button
                        key={meal}
                        type="button"
                        onClick={() => setScopeMeal(meal)}
                        aria-pressed={scopeMeal === meal}
                        className={cn(
                          'rounded-full px-2.5 py-1 text-xs font-medium transition',
                          scopeMeal === meal
                            ? 'bg-accent-tint text-accent-strong'
                            : 'border border-border text-muted-foreground hover:bg-muted',
                        )}
                      >
                        {meal}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {scopeKind === 'slot' && (
              <p className="text-xs text-muted-foreground">
                Will appear alongside <strong>{scopeDay} {scopeMeal}</strong>.
              </p>
            )}
            {scopeKind === 'week' && (
              <p className="text-xs text-muted-foreground">
                Will appear in the grocery list as a week-wide addon — not tied to a
                specific slot.
              </p>
            )}
          </div>
        )}

        <SheetFooter className="flex-row gap-2 pt-4">
          <Button variant="outline" className="flex-1" onClick={onClose}>
            Cancel
          </Button>
          <Button
            className="flex-1"
            disabled={!selected}
            onClick={handleAttach}
          >
            Attach addon
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}

// ── Attached addons list ───────────────────────────────────────────────────────

const AttachedAddonRow = ({
  item,
  onDetach,
}: {
  item: AttachedAddon
  onDetach: ({ id }: { id: string }) => void
}) => (
  <div className="flex items-center gap-3 rounded-xl border border-border bg-card px-3 py-2.5">
    <span className="text-xl leading-none" aria-hidden>{item.addon.emoji}</span>
    <div className="flex min-w-0 flex-1 flex-col gap-0.5">
      <span className="text-sm font-medium">{item.addon.name}</span>
      <div className="flex items-center gap-1.5">
        <Badge
          variant="outline"
          className={cn(
            'text-[10px] px-1.5 py-0',
            item.scope.kind === 'week'
              ? 'border-border bg-muted text-muted-foreground'
              : 'border-accent-strong/20 bg-accent-tint text-accent-strong',
          )}
        >
          {scopeLabel(item.scope)}
        </Badge>
      </div>
    </div>
    <button
      type="button"
      onClick={() => onDetach({ id: item.id })}
      aria-label={`Detach ${item.addon.name}`}
      className="text-muted-foreground hover:text-destructive transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
    >
      <Trash2 className="size-4" aria-hidden />
    </button>
  </div>
)

// ── Screen ─────────────────────────────────────────────────────────────────────
export const MenuAddonScreen = () => {
  const [pickerOpen, setPickerOpen] = useState(false)
  const [attachedAddons, setAttachedAddons] = useState<AttachedAddon[]>([
    {
      id: 'att1',
      addon: MOCK_ADDONS[0]!,
      scope: { kind: 'week' },
    },
    {
      id: 'att2',
      addon: MOCK_ADDONS[1]!,
      scope: { kind: 'slot', day: 'Tue', meal: 'Lunch' },
    },
  ])

  const handleAttach = ({ addon, scope }: { addon: MockAddon; scope: AttachScope }) => {
    setAttachedAddons((prev) => [
      ...prev,
      { id: `att-${Date.now()}`, addon, scope },
    ])
  }

  const handleDetach = ({ id }: { id: string }) => {
    setAttachedAddons((prev) => prev.filter((a) => a.id !== id))
  }

  const existingAddonIds = attachedAddons.map((a) => a.addon.id)

  return (
    <CozyShell active="menu" title="Weekly menu">
      <AddonPickerSheet
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onAttach={handleAttach}
        existingAddonIds={existingAddonIds}
      />

      <div className="flex flex-col gap-5">
        {/* Page header */}
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex flex-col gap-0.5">
            <h2 className="text-base font-semibold">Week of Jun 9</h2>
            <p className="text-sm text-muted-foreground">Menu accepted · 7 slots</p>
          </div>
          <Badge variant="outline" className="bg-success-tint text-success border-transparent">
            Accepted
          </Badge>
        </div>

        {/* ── v2.1 NEW — Addon attach section ────────────────────────────── */}
        <section className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-5 shadow-md">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Package className="size-4 text-muted-foreground" aria-hidden />
              <div>
                <h2 className="text-sm font-semibold">Addons</h2>
                <p className="text-xs text-muted-foreground">
                  Accompaniments (salsa, guac, desserts) that go with this menu. Attaching
                  one adds its ingredients to the grocery list without changing the menu
                  schedule.
                </p>
              </div>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setPickerOpen(true)}
              className="shrink-0 gap-1.5"
            >
              <Plus className="size-3.5" aria-hidden />
              Attach addon
            </Button>
          </div>

          {attachedAddons.length === 0 ? (
            <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border bg-muted/30 py-6 text-center">
              <Package className="size-5 text-muted-foreground" aria-hidden />
              <p className="text-sm text-muted-foreground">No addons attached yet.</p>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setPickerOpen(true)}
                className="gap-1.5"
              >
                <Plus className="size-3.5" aria-hidden />
                Attach your first addon
              </Button>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {attachedAddons.map((item) => (
                <AttachedAddonRow key={item.id} item={item} onDetach={handleDetach} />
              ))}
            </div>
          )}
        </section>

        {/* Menu grid placeholder (context) */}
        <section className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-5 shadow-md opacity-60">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold">Menu grid</h2>
            <Badge variant="outline" className="text-xs">context only — collapsed in mock</Badge>
          </div>
          <p className="text-xs text-muted-foreground">
            The full calendar grid (MenuExecScreen) sits here — collapsed so the addon
            attach control stays in focus.
          </p>
        </section>
      </div>
    </CozyShell>
  )
}
