'use client'

import { useMemo, useState } from 'react'
import { CalendarRange, Download, Sparkles } from 'lucide-react'
import {
  useActiveMenu,
  useRecipesList,
} from '@weekly-food-planner/supabase/react'
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
import {
  downloadMenuExport,
  type ExportFormat,
} from '@/lib/hooks/export-menu'
import { ActiveMenuView } from './_components/active-menu-view'
import { GenerateMenuDialog } from './_components/generate-menu-dialog'

const MenuPage = () => {
  const supabase = useSupabase()
  const { workspace, isLoading: workspaceLoading } = useActiveWorkspace()
  const menuQuery = useActiveMenu({
    supabase,
    workspaceId: workspace?.id ?? null,
    enabled: !!workspace,
  })
  const recipesQuery = useRecipesList({
    supabase,
    workspaceId: workspace?.id ?? null,
    enabled: !!workspace && !!menuQuery.data,
  })

  const [generateOpen, setGenerateOpen] = useState(false)
  const isLoading = workspaceLoading || menuQuery.isLoading

  const recipeNamesById = useMemo(() => {
    const map: Record<string, string> = {}
    for (const recipe of recipesQuery.data ?? []) {
      map[recipe.id] = recipe.name
    }
    return map
  }, [recipesQuery.data])

  const menu = menuQuery.data
  const hasMenu = !!menu

  const handleExport = (format: ExportFormat) => {
    if (!workspace || !menu) return
    downloadMenuExport({
      workspaceId: workspace.id,
      format,
      weekStartDate: menu.week_start_date,
    })
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      <PageHeader
        title="Weekly menu"
        description="Deterministic generation of the week's plan."
        actions={
          <>
            {hasMenu ? (
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
              onClick={() => setGenerateOpen(true)}
              disabled={!workspace}
            >
              <Sparkles className="size-4" />
              {hasMenu ? 'Regenerate' : 'Generate menu'}
            </Button>
          </>
        }
      />

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
      ) : menuQuery.error ? (
        <EmptyState
          icon={CalendarRange}
          title="Couldn't load the active menu"
          description={
            menuQuery.error instanceof Error
              ? menuQuery.error.message
              : 'Unknown error.'
          }
        />
      ) : !menu ? (
        <EmptyState
          icon={CalendarRange}
          title="No active menu yet"
          description="Click Generate menu above to assign a recipe to every member-meal slot for the week."
          action={
            <Button onClick={() => setGenerateOpen(true)} disabled={!workspace}>
              <Sparkles className="size-4" />
              Generate menu
            </Button>
          }
        />
      ) : (
        <ActiveMenuView menu={menu} recipeNamesById={recipeNamesById} />
      )}

      {workspace ? (
        <GenerateMenuDialog
          workspaceId={workspace.id}
          open={generateOpen}
          onOpenChange={setGenerateOpen}
          mode={hasMenu ? 'regenerate' : 'create'}
        />
      ) : null}
    </div>
  )
}

export default MenuPage
