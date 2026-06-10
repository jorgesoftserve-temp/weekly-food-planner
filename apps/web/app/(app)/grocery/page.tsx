'use client'

import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useCallback, useMemo, useState } from 'react'
import {
  AlertTriangle,
  CalendarRange,
  Download,
  Refrigerator,
  ShoppingCart,
  Sparkles,
} from 'lucide-react'
import {
  useActiveGroceryLists,
  useActiveMenu,
  useIngredients,
  useUpcomingMenus,
  useWorkspaceWithMembers,
} from '@weekly-food-planner/supabase/react'
import type { IngredientRecord } from '@weekly-food-planner/supabase'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { EmptyState } from '@/components/empty-state'
import { PageHeader } from '@/components/page-header'
import { useActiveWorkspace } from '@/components/workspace-provider'
import { useSupabase } from '@/lib/hooks/use-supabase'
import {
  downloadMenuExport,
  type ExportFormat,
} from '@/lib/hooks/export-menu'
import { applyShopForFilter } from '@/lib/grocery-filter'
import { IngredientDetailDialog } from './_components/ingredient-detail-dialog'
import { ShopForPicker } from './_components/shop-for-picker'

const capitalize = (s: string): string =>
  s.length === 0 ? s : s.charAt(0).toUpperCase() + s.slice(1)

const formatQuantity = (n: number): string => {
  const rounded = Math.round(n * 1000) / 1000
  return Number.isInteger(rounded) ? rounded.toString() : rounded.toString()
}

const SHOP_FOR_PARAM = 'shop_for'

const GroceryPage = () => {
  const supabase = useSupabase()
  const router = useRouter()
  const searchParams = useSearchParams()
  const { workspace, isLoading: workspaceLoading } = useActiveWorkspace()
  // Track which upcoming menu the user is shopping for. The default (null)
  // means "soonest upcoming" — getActiveGroceryLists already picks that.
  // Once the user changes the selector we pass the explicit week.
  const [selectedWeek, setSelectedWeek] = useState<string | null>(null)

  // Shop-for-subset selection lives in the URL so the filter survives
  // refresh and can be shared / bookmarked. Comma-separated member ids;
  // absent param = whole household.
  const shopForRaw = searchParams.get(SHOP_FOR_PARAM)
  const selectedShopForIds = useMemo<string[] | null>(() => {
    if (!shopForRaw) return null
    const parts = shopForRaw
      .split(',')
      .map((s) => s.trim())
      .filter((s) => s.length > 0)
    return parts.length > 0 ? parts : null
  }, [shopForRaw])
  const setShopForIds = useCallback(
    (next: string[] | null) => {
      const params = new URLSearchParams(searchParams.toString())
      if (next === null || next.length === 0) {
        params.delete(SHOP_FOR_PARAM)
      } else {
        params.set(SHOP_FOR_PARAM, next.join(','))
      }
      const query = params.toString()
      router.replace(query.length > 0 ? `?${query}` : '?', { scroll: false })
    },
    [router, searchParams],
  )
  const upcomingQuery = useUpcomingMenus({
    supabase,
    workspaceId: workspace?.id ?? null,
    enabled: !!workspace,
  })
  const groceryQuery = useActiveGroceryLists({
    supabase,
    workspaceId: workspace?.id ?? null,
    weekStartDate: selectedWeek ?? undefined,
    enabled: !!workspace,
  })
  const ingredientsQuery = useIngredients({
    supabase,
    enabled: !!groceryQuery.data,
  })
  const workspaceQuery = useWorkspaceWithMembers({
    supabase,
    workspaceId: workspace?.id ?? null,
    enabled: !!workspace && !!groceryQuery.data,
  })
  const activeMenuQuery = useActiveMenu({
    supabase,
    workspaceId: workspace?.id ?? null,
    enabled: !!workspace && !!groceryQuery.data,
  })

  const [selectedIngredientId, setSelectedIngredientId] = useState<string | null>(
    null,
  )

  const ingredientsById = useMemo(() => {
    const map: Record<string, IngredientRecord> = {}
    for (const ing of ingredientsQuery.data ?? []) {
      map[ing.id] = ing
    }
    return map
  }, [ingredientsQuery.data])

  const memberNamesById = useMemo(() => {
    const map: Record<string, string> = {}
    for (const m of workspaceQuery.data?.workspace_members ?? []) {
      map[m.id] = m.name
    }
    return map
  }, [workspaceQuery.data])

  const activeMenuRecipeIds = useMemo(() => {
    const set = new Set<string>()
    for (const slot of activeMenuQuery.data?.menu_slots ?? []) {
      set.add(slot.recipe_id)
    }
    return set
  }, [activeMenuQuery.data])

  const isLoading = workspaceLoading || groceryQuery.isLoading
  const grocery = groceryQuery.data

  // menu_participants is the head-count denominator for shared-list scaling.
  // Falls back to workspace_members when the active menu hasn't loaded yet
  // (the picker is still useful — the math just isn't applied until the menu
  // is available).
  const participantIds = useMemo(() => {
    const fromMenu =
      activeMenuQuery.data?.menu_participants?.map((p) => p.member_id) ?? []
    if (fromMenu.length > 0) return fromMenu
    return workspaceQuery.data?.workspace_members?.map((m) => m.id) ?? []
  }, [activeMenuQuery.data, workspaceQuery.data])

  // Apply the shop-for filter (scale shared, filter per-member) before sort.
  // Shared bucket stays first regardless of filter state.
  const filteredLists = useMemo(() => {
    if (!grocery) return []
    return applyShopForFilter({
      lists: grocery.lists,
      participantIds,
      selectedIds: selectedShopForIds,
    })
  }, [grocery, participantIds, selectedShopForIds])

  const sortedLists = useMemo(() => {
    return [...filteredLists].sort((a, b) => {
      if (a.target_member_id === null && b.target_member_id !== null) return -1
      if (a.target_member_id !== null && b.target_member_id === null) return 1
      const na = a.target_member_id
        ? memberNamesById[a.target_member_id] ?? ''
        : ''
      const nb = b.target_member_id
        ? memberNamesById[b.target_member_id] ?? ''
        : ''
      return na.localeCompare(nb)
    })
  }, [filteredLists, memberNamesById])

  const handleExport = (format: ExportFormat) => {
    if (!workspace || !grocery) return
    downloadMenuExport({
      workspaceId: workspace.id,
      format,
      weekStartDate: grocery.weekStartDate,
      shopForIds: selectedShopForIds,
    })
  }

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
      <PageHeader
        title="Grocery list"
        description={
          grocery
            ? `Aggregated for the week of ${grocery.weekStartDate}.`
            : 'Aggregated shopping list for the active menu.'
        }
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {(upcomingQuery.data?.length ?? 0) > 1 ? (
              <Select
                value={selectedWeek ?? grocery?.weekStartDate ?? undefined}
                onValueChange={(value) => setSelectedWeek(value)}
              >
                <SelectTrigger className="h-9 w-[220px] text-sm">
                  <SelectValue placeholder="Pick an upcoming menu" />
                </SelectTrigger>
                <SelectContent>
                  {(upcomingQuery.data ?? []).map((menu) => (
                    <SelectItem key={menu.id} value={menu.week_start_date}>
                      Week of {menu.week_start_date} · {menu.duration_days}d
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : null}
            {grocery ? (
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
          </div>
        }
      />

      {isLoading ? (
        <div className="flex flex-col gap-4">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
      ) : groceryQuery.error ? (
        <EmptyState
          icon={ShoppingCart}
          title="Couldn't load the grocery list"
          description={
            groceryQuery.error instanceof Error
              ? groceryQuery.error.message
              : 'Unknown error.'
          }
        />
      ) : !grocery ? (
        <EmptyState
          icon={CalendarRange}
          title="No active menu"
          description="Generate a menu first — the grocery list comes from the active menu's recipes."
          action={
            <Button asChild>
              <Link href="/menu">Go to menu</Link>
            </Button>
          }
        />
      ) : sortedLists.length === 0 ? (
        <EmptyState
          icon={ShoppingCart}
          title="No grocery items"
          description="The active menu didn't produce a grocery list. This usually means no slots were filled — check the menu page."
        />
      ) : (
        <TooltipProvider delayDuration={150}>
          <div className="flex flex-col gap-4">
            {participantIds.length > 0 ? (
              <ShopForPicker
                participantIds={participantIds}
                memberNamesById={memberNamesById}
                selectedIds={selectedShopForIds}
                onChange={setShopForIds}
              />
            ) : null}
            {sortedLists.map((list) => {
              const heading =
                list.target_member_id === null
                  ? 'Shared'
                  : `Per member: ${
                      memberNamesById[list.target_member_id] ??
                      `[unknown:${list.target_member_id.slice(0, 6)}]`
                    }`
              const sortedItems = [...list.scaledItems].sort((a, b) => {
                const na =
                  ingredientsById[a.ingredient_id]?.name ?? a.ingredient_id
                const nb =
                  ingredientsById[b.ingredient_id]?.name ?? b.ingredient_id
                return na.localeCompare(nb)
              })
              return (
                <Card key={list.id}>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">{heading}</CardTitle>
                    <CardDescription>
                      {sortedItems.length}{' '}
                      {sortedItems.length === 1 ? 'item' : 'items'} — tap an
                      ingredient for freshness rules and which recipes need it.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <div className="divide-y divide-border">
                      {sortedItems.map((item) => {
                        const ing = ingredientsById[item.ingredient_id]
                        const name =
                          ing?.name ??
                          `[unknown:${item.ingredient_id.slice(0, 6)}]`
                        const qty = item.quantity
                        const allergenCount =
                          ing?.ingredient_allergens.length ?? 0
                        return (
                          <div
                            key={item.id}
                            className="flex min-h-11 items-center gap-3 py-1.5"
                          >
                            <button
                              type="button"
                              onClick={() =>
                                setSelectedIngredientId(item.ingredient_id)
                              }
                              className="flex min-w-0 flex-1 items-center gap-2 text-left text-sm font-medium hover:underline underline-offset-4"
                            >
                              <span className="truncate">{name}</span>
                              {ing?.requires_fresh ? (
                                <>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Sparkles
                                        className="size-3.5 shrink-0 text-sky-600 dark:text-sky-400"
                                        aria-hidden
                                      />
                                    </TooltipTrigger>
                                    <TooltipContent>
                                      Requires fresh purchase
                                    </TooltipContent>
                                  </Tooltip>
                                  <span className="sr-only">
                                    — requires fresh purchase
                                  </span>
                                </>
                              ) : ing?.is_perishable ? (
                                <>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Refrigerator
                                        className="size-3.5 shrink-0 text-warning"
                                        aria-hidden
                                      />
                                    </TooltipTrigger>
                                    <TooltipContent>
                                      Perishable
                                      {ing.max_storage_days != null
                                        ? ` — keeps ~${ing.max_storage_days}d`
                                        : ''}
                                    </TooltipContent>
                                  </Tooltip>
                                  <span className="sr-only">
                                    — perishable
                                    {ing.max_storage_days != null
                                      ? `, keeps about ${ing.max_storage_days} days`
                                      : ''}
                                  </span>
                                </>
                              ) : null}
                              {allergenCount > 0 ? (
                                <>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <AlertTriangle
                                        className="size-3.5 shrink-0 text-destructive"
                                        aria-hidden
                                      />
                                    </TooltipTrigger>
                                    <TooltipContent>
                                      {allergenCount} allergen
                                      {allergenCount === 1 ? '' : 's'} tagged
                                    </TooltipContent>
                                  </Tooltip>
                                  <span className="sr-only">
                                    — {allergenCount} allergen
                                    {allergenCount === 1 ? '' : 's'} tagged
                                  </span>
                                </>
                              ) : null}
                            </button>
                            {item.scheduled_purchase_day ? (
                              <span className="hidden shrink-0 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground sm:inline">
                                {capitalize(item.scheduled_purchase_day)}
                              </span>
                            ) : null}
                            <span className="shrink-0 text-sm tabular-nums text-muted-foreground">
                              {formatQuantity(qty)} {item.unit}
                            </span>
                          </div>
                        )
                      })}
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </TooltipProvider>
      )}

      <IngredientDetailDialog
        workspaceId={workspace?.id ?? null}
        ingredientId={selectedIngredientId}
        activeMenuRecipeIds={activeMenuRecipeIds}
        open={!!selectedIngredientId}
        onOpenChange={(open) => {
          if (!open) setSelectedIngredientId(null)
        }}
      />
    </div>
  )
}

export default GroceryPage
