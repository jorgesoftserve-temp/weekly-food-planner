'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { use, useMemo, useState } from 'react'
import { ArrowLeft, CalendarRange, Copy, History } from 'lucide-react'
import {
  useGroceryListsForMenuId,
  useIngredients,
  useMenuById,
  useRecipesList,
  useWorkspaceWithMembers,
} from '@weekly-food-planner/supabase/react'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/empty-state'
import { PageHeader } from '@/components/page-header'
import { useActiveWorkspace } from '@/components/workspace-provider'
import { useSupabase } from '@/lib/hooks/use-supabase'
import { useCloneMenu } from '@/lib/hooks/use-clone-menu'
import { notifyError, notifySuccess } from '@/lib/toast'
import { MenuView } from '../../_components/menu-view'
import { CloneTargetDialog } from '../_components/clone-target-dialog'

const formatQuantity = (n: number): string => {
  const rounded = Math.round(n * 1000) / 1000
  return rounded.toString()
}

const MenuHistoryDetailPage = ({
  params,
}: {
  params: Promise<{ menuId: string }>
}) => {
  const { menuId } = use(params)
  const router = useRouter()
  const supabase = useSupabase()
  const { workspace, isLoading: workspaceLoading } = useActiveWorkspace()

  const menuQuery = useMenuById({
    supabase,
    workspaceId: workspace?.id ?? null,
    menuId,
    enabled: !!workspace,
  })
  const groceryQuery = useGroceryListsForMenuId({
    supabase,
    workspaceId: workspace?.id ?? null,
    menuId,
    enabled: !!workspace && !!menuQuery.data,
  })
  const recipesQuery = useRecipesList({
    supabase,
    workspaceId: workspace?.id ?? null,
    enabled: !!workspace && !!menuQuery.data,
  })
  const workspaceMembersQuery = useWorkspaceWithMembers({
    supabase,
    workspaceId: workspace?.id ?? null,
    enabled: !!workspace && !!menuQuery.data,
  })
  const ingredientsQuery = useIngredients({
    supabase,
    enabled: !!groceryQuery.data,
  })

  const cloneMutation = useCloneMenu({ workspaceId: workspace?.id ?? '' })
  const [cloneOpen, setCloneOpen] = useState(false)

  const recipeNamesById = useMemo(() => {
    const map: Record<string, string> = {}
    for (const r of recipesQuery.data ?? []) map[r.id] = r.name
    return map
  }, [recipesQuery.data])

  const memberNamesById = useMemo(() => {
    const map: Record<string, string> = {}
    for (const m of workspaceMembersQuery.data?.workspace_members ?? []) {
      map[m.id] = m.name
    }
    return map
  }, [workspaceMembersQuery.data])

  const ingredientNamesById = useMemo(() => {
    const map: Record<string, string> = {}
    for (const i of ingredientsQuery.data ?? []) map[i.id] = i.name
    return map
  }, [ingredientsQuery.data])

  // Sort lists shared-first, then alphabetically by member name, mirroring
  // the grocery page's ordering for consistency.
  const sortedGroceryLists = useMemo(() => {
    const lists = groceryQuery.data ?? []
    return [...lists].sort((a, b) => {
      if (a.target_member_id === null && b.target_member_id !== null) return -1
      if (a.target_member_id !== null && b.target_member_id === null) return 1
      const na = a.target_member_id ? memberNamesById[a.target_member_id] ?? '' : ''
      const nb = b.target_member_id ? memberNamesById[b.target_member_id] ?? '' : ''
      return na.localeCompare(nb)
    })
  }, [groceryQuery.data, memberNamesById])

  const isLoading = workspaceLoading || menuQuery.isLoading
  const menu = menuQuery.data

  const handleCloneConfirm = async ({
    weekStartDate,
  }: {
    weekStartDate: string
  }) => {
    if (!workspace || !menu) return
    try {
      await cloneMutation.mutateAsync({
        sourceMenuId: menu.id,
        weekStartDate,
      })
      notifySuccess('Menu cloned as a draft. Review it on the menu page.')
      setCloneOpen(false)
      router.push('/menu')
    } catch (err) {
      notifyError(err instanceof Error ? err.message : 'Clone failed.')
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
      <PageHeader
        title={menu ? `Week of ${menu.week_start_date}` : 'Menu detail'}
        description={
          menu
            ? `Read-only view of a past ${menu.menu_type} menu. Clone it as a draft to plan a new week from this one.`
            : 'Loading…'
        }
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button asChild variant="ghost" size="sm">
              <Link href="/menu/history">
                <ArrowLeft className="size-4" />
                Back to history
              </Link>
            </Button>
            {menu ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setCloneOpen(true)}
                disabled={cloneMutation.isPending}
              >
                <Copy className="size-4" />
                Clone as draft
              </Button>
            ) : null}
          </div>
        }
      />

      {isLoading ? (
        <div className="flex flex-col gap-3">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      ) : menuQuery.error ? (
        <EmptyState
          icon={History}
          title="Couldn't load this menu"
          description={
            menuQuery.error instanceof Error
              ? menuQuery.error.message
              : 'Unknown error.'
          }
        />
      ) : !menu ? (
        <EmptyState
          icon={CalendarRange}
          title="Menu not found"
          description="This menu may have been deleted, or you don't have access to it."
          action={
            <Button asChild>
              <Link href="/menu/history">Back to history</Link>
            </Button>
          }
        />
      ) : (
        <div className="flex flex-col gap-6">
          <MenuView
            menu={menu}
            recipeNamesById={recipeNamesById}
            memberNamesById={memberNamesById}
            editable={false}
          />

          {sortedGroceryLists.length > 0 ? (
            <section className="flex flex-col gap-3">
              <h2 className="text-lg font-semibold">Grocery list</h2>
              <p className="text-sm text-muted-foreground">
                Persisted at the time this menu was accepted.
              </p>
              <ul className="flex flex-col gap-3">
                {sortedGroceryLists.map((list) => {
                  const heading =
                    list.target_member_id === null
                      ? 'Shared'
                      : memberNamesById[list.target_member_id] ??
                        `[unknown:${list.target_member_id.slice(0, 6)}]`
                  return (
                    <li key={list.id}>
                      <Card>
                        <CardHeader className="pb-2">
                          <CardTitle className="text-base">{heading}</CardTitle>
                        </CardHeader>
                        <CardContent>
                          {list.grocery_items.length === 0 ? (
                            <p className="text-sm text-muted-foreground">
                              No items.
                            </p>
                          ) : (
                            <ul className="flex flex-col gap-1 text-sm">
                              {list.grocery_items
                                .slice()
                                .sort((a, b) => {
                                  const na =
                                    ingredientNamesById[a.ingredient_id] ??
                                    a.ingredient_id
                                  const nb =
                                    ingredientNamesById[b.ingredient_id] ??
                                    b.ingredient_id
                                  return na.localeCompare(nb)
                                })
                                .map((item) => {
                                  const name =
                                    ingredientNamesById[item.ingredient_id] ??
                                    `[unknown:${item.ingredient_id.slice(0, 6)}]`
                                  const qty =
                                    typeof item.quantity === 'string'
                                      ? Number.parseFloat(item.quantity)
                                      : item.quantity
                                  return (
                                    <li
                                      key={item.id}
                                      className="flex items-center justify-between gap-3 border-b border-border/40 py-1 last:border-b-0"
                                    >
                                      <span>{name}</span>
                                      <span className="font-mono text-xs text-muted-foreground">
                                        {formatQuantity(qty)} {item.unit}
                                      </span>
                                    </li>
                                  )
                                })}
                            </ul>
                          )}
                        </CardContent>
                      </Card>
                    </li>
                  )
                })}
              </ul>
            </section>
          ) : null}
        </div>
      )}

      {menu ? (
        <CloneTargetDialog
          open={cloneOpen}
          onOpenChange={setCloneOpen}
          sourceWeekStartDate={menu.week_start_date}
          sourceMenuType={menu.menu_type}
          sourceDurationDays={menu.duration_days}
          isPending={cloneMutation.isPending}
          onConfirm={handleCloneConfirm}
        />
      ) : null}
    </div>
  )
}

export default MenuHistoryDetailPage
