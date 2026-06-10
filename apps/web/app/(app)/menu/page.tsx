'use client'

import Link from 'next/link'
import { useMemo } from 'react'
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
  useRecipesList,
  useWorkspaceWithMembers,
} from '@weekly-food-planner/supabase/react'
import type { MenuSlotRecord } from '@weekly-food-planner/supabase'
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
import { GenerateMenuDialog } from './_components/generate-menu-dialog'
import { MenuView } from './_components/menu-view'
import { ReplaceSlotDialog } from './_components/replace-slot-dialog'

// Exactly one menu overlay is open at a time (generate / replace-slot /
// add-slot) — see hooks/use-exclusive-overlay.ts.
type MenuOverlay =
  | { kind: 'generate' }
  | { kind: 'replace'; slot: MenuSlotRecord }
  | { kind: 'addSlot'; day: string }

const MenuPage = () => {
  const supabase = useSupabase()
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

  const draft = draftQuery.data
  const activeMenu = activeMenuQuery.data
  const isReviewingDraft = !!draft

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
        <MenuView
          menu={activeMenu}
          recipeNamesById={recipeNamesById}
          memberNamesById={memberNamesById}
        />
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
    </div>
  )
}

export default MenuPage
