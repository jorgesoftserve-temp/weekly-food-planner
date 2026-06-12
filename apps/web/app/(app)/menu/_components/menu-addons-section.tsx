'use client'

import { useMemo, useState } from 'react'
import { Check, Package, Plus, Search, Trash2 } from 'lucide-react'
import {
  useAttachMenuAddon,
  useDetachMenuAddon,
  useMenuAddons,
  useRecipesList,
} from '@weekly-food-planner/supabase/react'
import type { RecipeRecord } from '@weekly-food-planner/supabase'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Skeleton } from '@/components/ui/skeleton'
import { useSupabase } from '@/lib/hooks/use-supabase'
import { notifyError, notifySuccess } from '@/lib/toast'
import { cn } from '@/lib/utils'

// Scope: week-wide (target_slot_id=null) or tied to a specific slot.
type AttachScope =
  | { kind: 'week' }
  | { kind: 'slot'; slotId: string; label: string }

type AddonPickerSheetProps = {
  workspaceId: string
  menuId: string
  open: boolean
  onClose: () => void
  existingAddonRecipeIds: Set<string>
  slots: Array<{ id: string; day_of_week: string; meal_key: string }>
}

const AddonPickerSheet = ({
  workspaceId,
  menuId,
  open,
  onClose,
  existingAddonRecipeIds,
  slots,
}: AddonPickerSheetProps) => {
  const supabase = useSupabase()
  const recipesQuery = useRecipesList({ supabase, workspaceId, enabled: open })
  const attachMutation = useAttachMenuAddon({ supabase, menuId })

  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<RecipeRecord | null>(null)
  const [scopeKind, setScopeKind] = useState<'week' | 'slot'>('week')
  const [scopeSlotId, setScopeSlotId] = useState<string>('')

  const addonRecipes = useMemo(
    () =>
      (recipesQuery.data ?? []).filter(
        (r) =>
          r.recipe_kind === 'addon' && !existingAddonRecipeIds.has(r.id),
      ),
    [recipesQuery.data, existingAddonRecipeIds],
  )

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase()
    return term === ''
      ? addonRecipes
      : addonRecipes.filter((r) => r.name.toLowerCase().includes(term))
  }, [addonRecipes, search])

  const handleClose = () => {
    setSearch('')
    setSelected(null)
    setScopeKind('week')
    setScopeSlotId('')
    onClose()
  }

  const handleAttach = async () => {
    if (!selected) return
    try {
      await attachMutation.mutateAsync({
        menu_id: menuId,
        workspace_id: workspaceId,
        addon_recipe_id: selected.id,
        target_slot_id: scopeKind === 'slot' && scopeSlotId ? scopeSlotId : null,
      })
      notifySuccess(`${selected.name} attached to menu.`)
      handleClose()
    } catch (err) {
      notifyError(
        err instanceof Error ? err.message : 'Could not attach addon.',
      )
    }
  }

  return (
    <Sheet open={open} onOpenChange={(v) => { if (!v) handleClose() }}>
      <SheetContent side="right" className="flex w-full flex-col gap-0 sm:max-w-md">
        <SheetHeader className="border-b border-border px-6 py-4">
          <SheetTitle>Attach addon</SheetTitle>
          <SheetDescription>
            Pick an addon recipe and choose whether it applies to the whole week
            or a specific meal slot.
          </SheetDescription>
        </SheetHeader>

        <div className="flex flex-1 flex-col gap-3 overflow-y-auto px-6 py-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search addon recipes…"
              className="pl-9"
              aria-label="Search addon recipes"
            />
          </div>

          {/* Addon list */}
          {recipesQuery.isLoading ? (
            <div className="flex flex-col gap-2">
              <Skeleton className="h-14 w-full" />
              <Skeleton className="h-14 w-full" />
            </div>
          ) : filtered.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">
              {addonRecipes.length === 0
                ? 'No addon recipes found. Create one in Recipes with recipe_kind=addon.'
                : 'No addons match your search.'}
            </p>
          ) : (
            <div className="flex flex-col gap-1">
              {filtered.map((addon) => {
                const isSelected = selected?.id === addon.id
                return (
                  <button
                    key={addon.id}
                    type="button"
                    onClick={() => setSelected(isSelected ? null : addon)}
                    aria-pressed={isSelected}
                    className={cn(
                      'flex items-start gap-3 rounded-xl border px-3 py-2.5 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                      isSelected
                        ? 'border-accent-strong/30 bg-accent-tint/40'
                        : 'border-border bg-background hover:bg-muted',
                    )}
                  >
                    <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <span className="text-sm font-medium">{addon.name}</span>
                      {addon.description && (
                        <span className="text-xs text-muted-foreground line-clamp-1">
                          {addon.description}
                        </span>
                      )}
                    </div>
                    {isSelected && (
                      <Check className="mt-1 size-4 shrink-0 text-accent-strong" aria-hidden />
                    )}
                  </button>
                )
              })}
            </div>
          )}

          {/* Scope picker — shown when an addon is selected */}
          {selected && (
            <div className="flex flex-col gap-3 rounded-xl border border-border bg-muted/50 p-3">
              <p className="text-xs font-medium text-muted-foreground">
                Attach <strong className="text-foreground">{selected.name}</strong> to:
              </p>

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
                    'flex flex-1 items-center justify-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                    scopeKind === 'week'
                      ? 'bg-background text-foreground shadow-sm'
                      : 'text-muted-foreground',
                  )}
                >
                  Week-wide
                </button>
                {slots.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setScopeKind('slot')}
                    aria-pressed={scopeKind === 'slot'}
                    className={cn(
                      'flex flex-1 items-center justify-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                      scopeKind === 'slot'
                        ? 'bg-background text-foreground shadow-sm'
                        : 'text-muted-foreground',
                    )}
                  >
                    Specific slot
                  </button>
                )}
              </div>

              {scopeKind === 'slot' && slots.length > 0 && (
                <div className="flex flex-col gap-1">
                  <span className="text-[10px] font-medium text-muted-foreground">Slot</span>
                  <div className="flex flex-col gap-1 max-h-40 overflow-y-auto">
                    {slots.map((s) => (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => setScopeSlotId(s.id)}
                        aria-pressed={scopeSlotId === s.id}
                        className={cn(
                          'flex items-center gap-2 rounded-lg border px-3 py-1.5 text-left text-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                          scopeSlotId === s.id
                            ? 'border-accent-strong/30 bg-accent-tint/30 font-medium'
                            : 'border-border hover:bg-muted',
                        )}
                      >
                        <span className="capitalize">{s.day_of_week}</span>
                        <span className="text-xs text-muted-foreground">·</span>
                        <span className="text-xs uppercase tracking-wide text-muted-foreground">{s.meal_key}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {scopeKind === 'week' && (
                <p className="text-xs text-muted-foreground">
                  Will appear in the grocery list as a week-wide addon — not tied
                  to a specific slot.
                </p>
              )}
            </div>
          )}
        </div>

        <SheetFooter className="border-t border-border px-6 py-4">
          <div className="flex w-full gap-2">
            <Button variant="outline" className="flex-1" onClick={handleClose}>
              Cancel
            </Button>
            <Button
              className="flex-1"
              disabled={!selected || attachMutation.isPending || (scopeKind === 'slot' && !scopeSlotId)}
              onClick={handleAttach}
            >
              {attachMutation.isPending ? 'Attaching…' : 'Attach addon'}
            </Button>
          </div>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}

// ── Attached addon row ──────────────────────────────────────────────────────────

type AttachedAddonRowProps = {
  addonId: string
  recipeName: string
  scope: AttachScope
  menuId: string
}

const AttachedAddonRow = ({ addonId, recipeName, scope, menuId }: AttachedAddonRowProps) => {
  const supabase = useSupabase()
  const detachMutation = useDetachMenuAddon({ supabase, menuId })

  const handleDetach = async () => {
    try {
      await detachMutation.mutateAsync({ addonId })
      notifySuccess(`${recipeName} detached from menu.`)
    } catch (err) {
      notifyError(err instanceof Error ? err.message : 'Could not detach addon.')
    }
  }

  return (
    <div className="flex items-center gap-3 rounded-xl border border-border bg-card px-3 py-2.5">
      <Package className="size-4 shrink-0 text-addon" aria-hidden />
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="text-sm font-medium">{recipeName}</span>
        <Badge
          variant="outline"
          className={cn(
            'w-fit text-[10px] px-1.5 py-0',
            scope.kind === 'week'
              ? 'border-border bg-muted text-muted-foreground'
              : 'border-addon/20 bg-addon-tint text-addon',
          )}
        >
          {scope.kind === 'week' ? 'Week-wide' : scope.label}
        </Badge>
      </div>
      <button
        type="button"
        onClick={handleDetach}
        disabled={detachMutation.isPending}
        aria-label={`Detach ${recipeName}`}
        className="text-muted-foreground hover:text-destructive transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded disabled:opacity-50"
      >
        <Trash2 className="size-4" aria-hidden />
      </button>
    </div>
  )
}

// ── Public section component ────────────────────────────────────────────────────

export type MenuAddonsSectionProps = {
  workspaceId: string
  menuId: string
  slots: Array<{ id: string; day_of_week: string; meal_key: string }>
  recipeNamesById: Record<string, string>
}

export const MenuAddonsSection = ({
  workspaceId,
  menuId,
  slots,
  recipeNamesById,
}: MenuAddonsSectionProps) => {
  const supabase = useSupabase()
  const addonsQuery = useMenuAddons({ supabase, menuId, enabled: !!menuId })
  const [pickerOpen, setPickerOpen] = useState(false)

  const addons = addonsQuery.data ?? []

  const existingAddonRecipeIds = useMemo(
    () => new Set(addons.map((a) => a.addon_recipe_id)),
    [addons],
  )

  const resolveScope = (addon: typeof addons[number]): AttachScope => {
    if (!addon.target_slot_id) return { kind: 'week' }
    const slot = slots.find((s) => s.id === addon.target_slot_id)
    const label = slot
      ? `${slot.day_of_week.charAt(0).toUpperCase() + slot.day_of_week.slice(1)} · ${slot.meal_key}`
      : 'Specific slot'
    return { kind: 'slot', slotId: addon.target_slot_id, label }
  }

  return (
    <>
      <AddonPickerSheet
        workspaceId={workspaceId}
        menuId={menuId}
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        existingAddonRecipeIds={existingAddonRecipeIds}
        slots={slots}
      />

      <section className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-5 shadow-md">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-2">
            <Package className="mt-0.5 size-4 shrink-0 text-addon" aria-hidden />
            <div className="flex flex-col gap-0.5">
              <h2 className="text-sm font-semibold text-addon">Addons</h2>
              <p className="text-xs text-muted-foreground">
                Accompaniments (salsa, sauces, desserts) attached to this menu.
                Their ingredients are added to the grocery list automatically.
              </p>
            </div>
          </div>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => setPickerOpen(true)}
            className="shrink-0 gap-1.5"
          >
            <Plus className="size-3.5" aria-hidden />
            Attach addon
          </Button>
        </div>

        {addonsQuery.isLoading ? (
          <div className="flex flex-col gap-2">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        ) : addons.length === 0 ? (
          <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border bg-muted/30 py-6 text-center">
            <Package className="size-5 text-muted-foreground" aria-hidden />
            <p className="text-sm text-muted-foreground">No addons attached yet.</p>
            <Button
              type="button"
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
            {addons.map((addon) => (
              <AttachedAddonRow
                key={addon.id}
                addonId={addon.id}
                recipeName={recipeNamesById[addon.addon_recipe_id] ?? `[addon:${addon.addon_recipe_id.slice(0, 6)}]`}
                scope={resolveScope(addon)}
                menuId={menuId}
              />
            ))}
          </div>
        )}
      </section>
    </>
  )
}
