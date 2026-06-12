'use client'

import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useCallback, useMemo, useState } from 'react'
import {
  CalendarRange,
  Check,
  Clock,
  Download,
  History,
  Sparkles,
  Trash2,
} from 'lucide-react'
import {
  useActiveMenu,
  useDraftMenu,
  useMenuSlotCompletions,
  useMenuSlotIngredientOverrides,
  useRecipesList,
  useWorkspaceWithMembers,
} from '@weekly-food-planner/supabase/react'
import type { DbTypes, MenuSlotRecord } from '@weekly-food-planner/supabase'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/empty-state'
import { PageHeader } from '@/components/page-header'
import { useActiveWorkspace } from '@/components/workspace-provider'
import { useSupabase } from '@/lib/hooks/use-supabase'
import { useExclusiveOverlay } from '@/hooks/use-exclusive-overlay'
import { useMenuShoppingAlerts } from '@/lib/hooks/use-menu-alerts'
import { useSetSlotCompletion } from '@/lib/hooks/use-slot-completion'
import type { SlotShoppingAlert } from '@/lib/api/menu-alerts'
import {
  downloadMenuExport,
  type ExportFormat,
} from '@/lib/hooks/export-menu'
import {
  useAcceptMenuDraft,
  useDiscardMenuDraft,
} from '@/lib/hooks/use-menu-draft'
import { notifyError, notifySuccess } from '@/lib/toast'
import { AddSlotDialog } from './_components/add-slot-dialog'
import { CookSheet } from './_components/cook-sheet'
import { GenerateMenuDialog } from './_components/generate-menu-dialog'
import { MenuAddonsSection } from './_components/menu-addons-section'
import { MenuMemberPicker } from './_components/menu-member-picker'
import { MenuView } from './_components/menu-view'
import { ReconcileSheet } from './_components/reconcile-sheet'
import { ReplaceSlotDialog } from './_components/replace-slot-dialog'
import { SubstituteSheet } from './_components/substitute-sheet'

// Exactly one menu overlay is open at a time (generate / replace-slot /
// add-slot) — see hooks/use-exclusive-overlay.ts.
type MenuOverlay =
  | { kind: 'generate' }
  | { kind: 'replace'; slot: MenuSlotRecord }
  | { kind: 'addSlot'; day: string }

const MEMBER_PARAM = 'member'

const MenuPage = () => {
  const supabase = useSupabase()
  const router = useRouter()
  const searchParams = useSearchParams()
  const { workspace, isLoading: workspaceLoading } = useActiveWorkspace()
  const activeMenuQuery = useActiveMenu({
    supabase,
    workspaceId: workspace?.id ?? null,
    enabled: !!workspace,
  })
  const draftQuery = useDraftMenu({
    supabase,
    workspaceId: workspace?.id ?? null,
    enabled: !!workspace,
  })
  const recipesQuery = useRecipesList({
    supabase,
    workspaceId: workspace?.id ?? null,
    enabled: !!workspace && (!!activeMenuQuery.data || !!draftQuery.data),
  })
  const workspaceQuery = useWorkspaceWithMembers({
    supabase,
    workspaceId: workspace?.id ?? null,
    enabled: !!workspace && (!!activeMenuQuery.data || !!draftQuery.data),
  })

  const acceptMutation = useAcceptMenuDraft({
    workspaceId: workspace?.id ?? '',
  })
  const discardMutation = useDiscardMenuDraft({
    workspaceId: workspace?.id ?? '',
  })

  const { overlay, open, onOpenChange } = useExclusiveOverlay<MenuOverlay>()
  // Cook sheet runs off the active (accepted) menu, independent of the draft
  // overlays above — so it gets its own slot state, not the overlay union.
  const [cookSlot, setCookSlot] = useState<MenuSlotRecord | null>(null)
  // (v2.0 Phase 5) Cook-time reconciliation sheet — opens when a slot is marked
  // cooked, and re-openable from the "Reconcile / leftovers" affordance.
  const [reconcileSlot, setReconcileSlot] = useState<MenuSlotRecord | null>(null)
  // (v2.0 Phase 6) Ingredient-substitution sheet for an accepted-menu slot.
  const [substituteSlot, setSubstituteSlot] = useState<MenuSlotRecord | null>(null)
  const isLoading =
    workspaceLoading || activeMenuQuery.isLoading || draftQuery.isLoading

  const recipeNamesById = useMemo(() => {
    const map: Record<string, string> = {}
    for (const recipe of recipesQuery.data ?? []) map[recipe.id] = recipe.name
    return map
  }, [recipesQuery.data])

  const memberNamesById = useMemo(() => {
    const map: Record<string, string> = {}
    for (const m of workspaceQuery.data?.workspace_members ?? [])
      map[m.id] = m.name
    return map
  }, [workspaceQuery.data])

  // (v2.0 item 10) Per-member menu view filter, URL-driven (?member=) like the
  // grocery ?shop_for= — survives refresh and is shareable. null = household.
  const memberFilter = searchParams.get(MEMBER_PARAM)
  const setMemberFilter = useCallback(
    (next: string | null) => {
      const params = new URLSearchParams(searchParams.toString())
      if (next === null) params.delete(MEMBER_PARAM)
      else params.set(MEMBER_PARAM, next)
      const query = params.toString()
      router.replace(query.length > 0 ? `?${query}` : '?', { scroll: false })
    },
    [router, searchParams],
  )

  const draft = draftQuery.data
  const activeMenu = activeMenuQuery.data
  const isReviewingDraft = !!draft

  // (v2.0 item 10) Members the active menu was generated for — drives the
  // per-member view switcher. Falls back to distinct slot target members.
  const activeParticipantIds = useMemo(() => {
    if (!activeMenu) return []
    const fromParticipants =
      activeMenu.menu_participants?.map((p) => p.member_id) ?? []
    if (fromParticipants.length > 0) return fromParticipants
    return Array.from(
      new Set(
        activeMenu.menu_slots
          .map((s) => s.target_member_id)
          .filter((id): id is string => id !== null),
      ),
    )
  }, [activeMenu])

  // (v2.0 Phase 3) Incomplete-shopping alerts for the accepted menu — only when
  // an active menu is being viewed (not while reviewing a draft).
  const alertsQuery = useMenuShoppingAlerts({
    workspaceId: workspace?.id ?? null,
    menuId: activeMenu?.id ?? null,
    enabled: !!workspace && !!activeMenu && !isReviewingDraft,
  })
  const alertsBySlotId = useMemo(() => {
    const map: Record<string, SlotShoppingAlert> = {}
    for (const alert of alertsQuery.data?.alerts ?? []) map[alert.slotId] = alert
    return map
  }, [alertsQuery.data])

  // (v2.0 Phase 4) Cook-status (planned/cooked/skipped) for the accepted menu.
  const completionsQuery = useMenuSlotCompletions({
    supabase,
    menuId: activeMenu?.id ?? null,
    enabled: !!workspace && !!activeMenu && !isReviewingDraft,
  })
  const cookStatusBySlotId = useMemo(() => {
    const map: Record<string, DbTypes.SlotCookStatus> = {}
    for (const c of completionsQuery.data ?? []) map[c.menu_slot_id] = c.status
    return map
  }, [completionsQuery.data])

  // (v2.0 parity) Weekly cook progress for the active-menu header — how many of
  // the menu's slots have been marked cooked. Absent completion = 'planned'.
  const cookedCount = useMemo(
    () =>
      (activeMenu?.menu_slots ?? []).filter(
        (s) => cookStatusBySlotId[s.id] === 'cooked',
      ).length,
    [activeMenu, cookStatusBySlotId],
  )
  const totalSlotCount = activeMenu?.menu_slots.length ?? 0

  // (v2.0 Phase 6) Ingredient overrides for the accepted menu — drives the
  // "Substituted" badge counts and seeds the substitution sheet's current state.
  const overridesQuery = useMenuSlotIngredientOverrides({
    supabase,
    menuId: activeMenu?.id ?? null,
    enabled: !!workspace && !!activeMenu && !isReviewingDraft,
  })
  const overrideCountBySlotId = useMemo(() => {
    const map: Record<string, number> = {}
    for (const o of overridesQuery.data ?? [])
      map[o.menu_slot_id] = (map[o.menu_slot_id] ?? 0) + 1
    return map
  }, [overridesQuery.data])
  const overridesBySlotAndOriginal = useMemo(() => {
    const map: Record<
      string,
      Record<
        string,
        { substitute_ingredient_id: string; quantity: number | null; unit: DbTypes.Unit | null }
      >
    > = {}
    for (const o of overridesQuery.data ?? []) {
      const bySlot = map[o.menu_slot_id] ?? {}
      bySlot[o.original_ingredient_id] = {
        substitute_ingredient_id: o.substitute_ingredient_id,
        quantity: o.quantity,
        unit: o.unit,
      }
      map[o.menu_slot_id] = bySlot
    }
    return map
  }, [overridesQuery.data])

  const setCookStatus = useSetSlotCompletion({
    workspaceId: workspace?.id ?? '',
    menuId: activeMenu?.id ?? null,
  })
  const handleSetCookStatus = async ({
    slot,
    status,
  }: {
    slot: MenuSlotRecord
    status: DbTypes.SlotCookStatus
  }) => {
    try {
      await setCookStatus.mutateAsync({ slotId: slot.id, status })
      // (v2.0 Phase 5) Marking a slot cooked opens the reconciliation so the
      // user can record what they actually used and save any remainder to the
      // pantry. Skippable — no inventory rows are created unless they save.
      if (status === 'cooked') setReconcileSlot(slot)
    } catch (err) {
      notifyError(err instanceof Error ? err.message : 'Could not update cook-status.')
    }
  }

  const handleExport = (format: ExportFormat) => {
    if (!workspace || !activeMenu) return
    downloadMenuExport({
      workspaceId: workspace.id,
      format,
      weekStartDate: activeMenu.week_start_date,
    })
  }

  const handleAccept = async () => {
    if (!draft) return
    try {
      await acceptMutation.mutateAsync({ menuId: draft.id })
      notifySuccess('Menu accepted. The grocery list is ready to shop.')
    } catch (err) {
      notifyError(err instanceof Error ? err.message : 'Accept failed.')
    }
  }

  const handleDiscard = async () => {
    if (!draft) return
    try {
      await discardMutation.mutateAsync({ menuId: draft.id })
      notifySuccess('Draft discarded.')
    } catch (err) {
      notifyError(err instanceof Error ? err.message : 'Discard failed.')
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      <PageHeader
        title="Weekly menu"
        description={
          isReviewingDraft
            ? 'Review your draft and accept it when you’re ready to shop.'
            : 'Deterministic generation of the week’s plan.'
        }
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button asChild variant="ghost" size="sm">
              <Link href="/menu/history">
                <History className="size-4" />
                History
              </Link>
            </Button>
            {activeMenu && !isReviewingDraft ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline">
                    <Download className="size-4" />
                    Export
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onSelect={() => handleExport('markdown')}>
                    Download Markdown
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => handleExport('csv')}>
                    Download CSV
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : null}
            <Button
              onClick={() => open({ kind: 'generate' })}
              disabled={!workspace}
            >
              <Sparkles className="size-4" />
              {isReviewingDraft
                ? 'Regenerate draft'
                : activeMenu
                  ? 'New menu'
                  : 'Generate menu'}
            </Button>
          </div>
        }
      />

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
      ) : activeMenuQuery.error ? (
        <EmptyState
          icon={CalendarRange}
          title="Couldn't load the menu"
          description={
            activeMenuQuery.error instanceof Error
              ? activeMenuQuery.error.message
              : 'Unknown error.'
          }
        />
      ) : null}

      {!isLoading && isReviewingDraft && draft ? (
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-3 rounded-2xl border border-warning/30 bg-gradient-hero px-4 py-3 text-sm shadow-sm sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-2">
              <Clock className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden />
              <div>
                <div className="flex items-center gap-2">
                  <p className="font-medium">Reviewing draft</p>
                  <span className="rounded-full bg-warning-tint px-2 py-0.5 text-xs font-medium text-warning">
                    Draft
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">
                  This menu isn&apos;t active yet — accept it to drive the
                  grocery list, or discard and try again. Generating again
                  replaces this draft.
                </p>
              </div>
            </div>
            <div className="flex shrink-0 gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleDiscard}
                disabled={discardMutation.isPending}
              >
                {discardMutation.isPending ? (
                  <>Discarding…</>
                ) : (
                  <>
                    <Trash2 className="size-4" />
                    Discard
                  </>
                )}
              </Button>
              <Button
                size="sm"
                onClick={handleAccept}
                disabled={acceptMutation.isPending}
              >
                {acceptMutation.isPending ? (
                  <>Accepting…</>
                ) : (
                  <>
                    <Check className="size-4" />
                    Accept menu
                  </>
                )}
              </Button>
            </div>
          </div>
          <MenuView
            menu={draft}
            recipeNamesById={recipeNamesById}
            memberNamesById={memberNamesById}
            editable
            onReplaceSlot={(slot) => open({ kind: 'replace', slot })}
            onAddSlot={(day) => open({ kind: 'addSlot', day })}
          />
        </div>
      ) : null}

      {!isLoading && !isReviewingDraft && activeMenu ? (
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            {activeParticipantIds.length > 1 ? (
              <MenuMemberPicker
                participantIds={activeParticipantIds}
                memberNamesById={memberNamesById}
                selectedId={memberFilter}
                onChange={setMemberFilter}
              />
            ) : (
              <span />
            )}
            {totalSlotCount > 0 ? (
              <div
                className="flex items-center gap-2 text-sm text-muted-foreground"
                aria-label={`${cookedCount} of ${totalSlotCount} meals cooked this week`}
              >
                <Check className="size-4 text-success" aria-hidden />
                <span>
                  <span className="font-medium tabular-nums text-foreground">
                    {cookedCount}
                  </span>{' '}
                  of{' '}
                  <span className="tabular-nums">{totalSlotCount}</span> meals
                  cooked
                </span>
              </div>
            ) : null}
          </div>
          <MenuView
            menu={activeMenu}
            recipeNamesById={recipeNamesById}
            memberNamesById={memberNamesById}
            onCookSlot={(slot) => setCookSlot(slot)}
            alertsBySlotId={alertsBySlotId}
            cookStatusBySlotId={cookStatusBySlotId}
            onSetCookStatus={handleSetCookStatus}
            onOpenReconcile={(slot) => setReconcileSlot(slot)}
            onOpenSubstitute={(slot) => setSubstituteSlot(slot)}
            overrideCountBySlotId={overrideCountBySlotId}
            filterMemberId={memberFilter}
          />
          {/* v2.1 — Addon attach control (accepted menu only) */}
          {workspace && (
            <MenuAddonsSection
              workspaceId={workspace.id}
              menuId={activeMenu.id}
              slots={activeMenu.menu_slots}
              recipeNamesById={recipeNamesById}
            />
          )}
        </div>
      ) : null}

      {!isLoading && !isReviewingDraft && !activeMenu && !activeMenuQuery.error ? (
        <EmptyState
          icon={CalendarRange}
          title="No active menu yet"
          description="Click Generate menu above to build a draft for the week. You can review and edit it before accepting."
          action={
            <Button
              onClick={() => open({ kind: 'generate' })}
              disabled={!workspace}
            >
              <Sparkles className="size-4" />
              Generate menu
            </Button>
          }
        />
      ) : null}

      {workspace ? (
        <GenerateMenuDialog
          workspaceId={workspace.id}
          open={overlay?.kind === 'generate'}
          onOpenChange={onOpenChange}
          mode={isReviewingDraft || activeMenu ? 'regenerate' : 'create'}
        />
      ) : null}

      {workspace && draft ? (
        <ReplaceSlotDialog
          workspaceId={workspace.id}
          menuId={draft.id}
          slot={overlay?.kind === 'replace' ? overlay.slot : null}
          open={overlay?.kind === 'replace'}
          onOpenChange={onOpenChange}
        />
      ) : null}

      {workspace && draft ? (
        <AddSlotDialog
          workspaceId={workspace.id}
          menu={draft}
          dayOfWeek={overlay?.kind === 'addSlot' ? overlay.day : null}
          memberNamesById={memberNamesById}
          open={overlay?.kind === 'addSlot'}
          onOpenChange={onOpenChange}
        />
      ) : null}

      {workspace && activeMenu ? (
        <CookSheet
          workspaceId={workspace.id}
          menuId={activeMenu.id}
          slot={cookSlot}
          recipeName={
            cookSlot ? recipeNamesById[cookSlot.recipe_id] ?? 'Recipe' : 'Recipe'
          }
          open={!!cookSlot}
          onOpenChange={(next) => {
            if (!next) setCookSlot(null)
          }}
          onCooked={(slot) => setReconcileSlot(slot)}
        />
      ) : null}

      {workspace && activeMenu ? (
        <ReconcileSheet
          workspaceId={workspace.id}
          menuId={activeMenu.id}
          slot={reconcileSlot}
          recipeName={
            reconcileSlot
              ? recipeNamesById[reconcileSlot.recipe_id] ?? 'Recipe'
              : 'Recipe'
          }
          open={!!reconcileSlot}
          onOpenChange={(next) => {
            if (!next) setReconcileSlot(null)
          }}
        />
      ) : null}

      {workspace && activeMenu ? (
        <SubstituteSheet
          workspaceId={workspace.id}
          menuId={activeMenu.id}
          slot={substituteSlot}
          recipeName={
            substituteSlot
              ? recipeNamesById[substituteSlot.recipe_id] ?? 'Recipe'
              : 'Recipe'
          }
          overridesByOriginal={
            substituteSlot
              ? overridesBySlotAndOriginal[substituteSlot.id] ?? {}
              : {}
          }
          open={!!substituteSlot}
          onOpenChange={(next) => {
            if (!next) setSubstituteSlot(null)
          }}
        />
      ) : null}
    </div>
  )
}

export default MenuPage
