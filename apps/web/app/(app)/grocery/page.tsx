'use client'

import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useCallback, useMemo, useState } from 'react'
import {
  AlertTriangle,
  CalendarRange,
  ChevronDown,
  ChevronUp,
  Download,
  Info,
  Package,
  Refrigerator,
  ShoppingCart,
  Sparkles,
} from 'lucide-react'
import {
  useActiveGroceryLists,
  useActiveMenu,
  useIngredients,
  useInventoryList,
  useUpcomingMenus,
  useWorkspaceWithMembers,
} from '@weekly-food-planner/supabase/react'
import type { IngredientRecord } from '@weekly-food-planner/supabase'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Separator } from '@/components/ui/separator'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
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
import {
  aggregateHouseholdGrocery,
  annotateWithInventory,
  applyShopForFilter,
  type AnnotatedGroceryItem,
  type InventoryOnHand,
} from '@/lib/grocery-filter'
import { IngredientDetailDialog } from './_components/ingredient-detail-dialog'
import { ShopForPicker } from './_components/shop-for-picker'
import {
  GroceryViewModePicker,
  type GroceryViewMode,
} from './_components/grocery-view-mode-picker'

const capitalize = (s: string): string =>
  s.length === 0 ? s : s.charAt(0).toUpperCase() + s.slice(1)

const formatQuantity = (n: number): string => {
  const rounded = Math.round(n * 1000) / 1000
  return Number.isInteger(rounded) ? rounded.toString() : rounded.toString()
}

const SHOP_FOR_PARAM = 'shop_for'
const VIEW_PARAM = 'view'

// (v2.0 parity) Pantry coverage indicator next to a grocery item. The required
// quantity stays the headline number (PRODUCT_PRD §17); on-hand stock lives
// here as a secondary annotation: a "Covered" badge when fully covered, else a
// focusable blue info dot whose popover shows what's on hand + suggested buy.
const PantryInfoDot = ({
  item,
  name,
}: {
  item: AnnotatedGroceryItem
  name: string
}) => {
  if (item.onHand <= 0) return null

  if (item.fullyCovered) {
    return (
      <Badge
        variant="outline"
        className="shrink-0 border-success/40 bg-success-tint px-1.5 py-0 text-[10px] text-success"
        aria-label={`${name} — fully covered by your pantry`}
      >
        Covered
      </Badge>
    )
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={`Pantry stock for ${name}`}
          className="inline-flex shrink-0 items-center justify-center rounded-full text-purchase focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1"
        >
          <Info className="size-3.5" aria-hidden />
        </button>
      </PopoverTrigger>
      <PopoverContent
        side="top"
        align="start"
        className="w-56 px-3 py-2.5 text-xs"
      >
        <p className="font-medium text-foreground">
          You have {formatQuantity(item.onHand)} {item.unit} in your pantry
        </p>
        {item.suggestedToBuy > 0 ? (
          <p className="mt-0.5 text-muted-foreground">
            Suggested to buy: {formatQuantity(item.suggestedToBuy)} {item.unit}
          </p>
        ) : null}
      </PopoverContent>
    </Popover>
  )
}

// ── Addon grocery group card ────────────────────────────────────────────────────
// Renders one food-group bucket of addon-sourced grocery lines. Visually distinct
// from meal-derived lines: uses text-addon / bg-addon-tint and a Package icon
// per the v21-grocery-addons design mock.

type AddonItemShape = {
  id: string
  ingredient_id: string
  ingredientName: string
  foodGroup: string
  quantity: number
  unit: string
}

type AddonGroceryGroupCardProps = {
  group: { foodGroup: string; items: AddonItemShape[] }
}

const AddonGroceryGroupCard = ({ group }: AddonGroceryGroupCardProps) => {
  const [open, setOpen] = useState(true)
  const panelId = `addon-group-${group.foodGroup.toLowerCase().replace(/\s+/g, '-')}`
  return (
    <Card className="overflow-hidden border-addon/30 bg-addon-tint/10">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between px-4 py-3 hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={`${open ? 'Collapse' : 'Expand'} ${group.foodGroup} addon group`}
      >
        <div className="flex items-center gap-2">
          <Package className="size-3.5 text-addon" aria-hidden />
          <span className="text-sm font-semibold text-addon">{group.foodGroup}</span>
          <span className="rounded-full border border-addon/30 bg-addon-tint px-1.5 py-0 text-[10px] font-medium text-addon">
            addon
          </span>
        </div>
        {open ? (
          <ChevronUp className="size-4 text-muted-foreground" aria-hidden />
        ) : (
          <ChevronDown className="size-4 text-muted-foreground" aria-hidden />
        )}
      </button>
      {open && (
        <CardContent id={panelId} className="divide-y divide-border pt-0">
          {group.items.map((item) => (
            <div
              key={item.id}
              className="flex min-h-11 items-center gap-3 py-1.5"
            >
              <div className="flex min-w-0 flex-1 items-center gap-2 text-sm font-medium">
                <span className="truncate">{item.ingredientName}</span>
                <span className="inline-flex items-center gap-1 rounded-full border border-addon/20 bg-addon-tint px-2 py-0.5 text-[10px] font-medium text-addon">
                  <Package className="size-2.5" aria-hidden />
                  addon
                </span>
              </div>
              <span className="shrink-0 text-sm font-medium tabular-nums text-foreground">
                {Math.round(item.quantity * 1000) / 1000} {item.unit}
              </span>
            </div>
          ))}
        </CardContent>
      )}
    </Card>
  )
}

// ── Page ────────────────────────────────────────────────────────────────────────

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
  // (v2.0 item 8) Grocery view mode: 'everyone' (consolidated household total)
  // or 'by-member' (per-member breakdown + shop-for subset). URL-driven so it
  // survives refresh, like shop_for. Default 'everyone' per the approved design.
  const viewMode: GroceryViewMode =
    searchParams.get(VIEW_PARAM) === 'by-member' ? 'by-member' : 'everyone'
  const setViewMode = useCallback(
    (next: GroceryViewMode) => {
      const params = new URLSearchParams(searchParams.toString())
      if (next === 'everyone') params.delete(VIEW_PARAM)
      else params.set(VIEW_PARAM, next)
      // Leaving by-member clears any subset selection so 'everyone' is truly all.
      if (next === 'everyone') params.delete(SHOP_FOR_PARAM)
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
  // (v2.0 §17) On-hand pantry stock for the non-destructive annotation. The GET
  // also runs the lazy leftover-expiry sweep server-side.
  const inventoryQuery = useInventoryList({
    supabase,
    workspaceId: workspace?.id ?? null,
    enabled: !!workspace && !!groceryQuery.data,
  })
  const onHandInventory = useMemo<InventoryOnHand[]>(
    () =>
      (inventoryQuery.data ?? []).map((i) => ({
        ingredient_id: i.ingredient_id,
        unit: i.unit,
        quantity: i.quantity,
      })),
    [inventoryQuery.data],
  )

  const [selectedIngredientId, setSelectedIngredientId] = useState<string | null>(
    null,
  )
  // (v2.0 parity) Ephemeral display toggle — hide lines already fully covered by
  // pantry stock so the shopper sees only what they still need to buy.
  const [collapseCovered, setCollapseCovered] = useState(false)

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

  // (v2.1) Addon grocery items — source='addon' rows from all lists, deduplicated
  // by (ingredient_id, unit) and summed across lists. Grouped by food_group for
  // the section header. These are rendered in a separate visually distinct section
  // using text-addon / bg-addon-tint tokens per the GroceryAddonsScreen design mock.
  type AddonGroceryEntry = {
    id: string
    ingredient_id: string
    ingredientName: string
    foodGroup: string
    quantity: number
    unit: string
  }
  type AddonGroceryGroup = { foodGroup: string; items: AddonGroceryEntry[] }

  const addonGroceryGroups = useMemo<AddonGroceryGroup[]>(() => {
    if (!grocery) return []
    // Aggregate addon items from all lists (avoid double-count: only use shared
    // bucket when present, same rule as aggregateHouseholdGrocery).
    const shared = grocery.lists.filter((l) => l.target_member_id === null)
    const source = shared.length > 0 ? shared : grocery.lists
    const byKey = new Map<string, { quantity: number; unit: string; id: string; ingredient_id: string }>()
    for (const list of source) {
      for (const item of list.grocery_items) {
        if (item.source !== 'addon') continue
        const key = `${item.ingredient_id}::${item.unit}`
        const existing = byKey.get(key)
        if (existing) {
          existing.quantity += Number(item.quantity)
        } else {
          byKey.set(key, {
            id: item.id,
            ingredient_id: item.ingredient_id,
            quantity: Number(item.quantity),
            unit: item.unit,
          })
        }
      }
    }
    if (byKey.size === 0) return []
    // Group by food_group using the ingredients catalog.
    const groupMap = new Map<string, AddonGroceryEntry[]>()
    for (const [, item] of byKey) {
      const ing = ingredientsById[item.ingredient_id]
      const foodGroup = ing?.food_group ?? 'Other'
      const name = ing?.name ?? `[unknown:${item.ingredient_id.slice(0, 6)}]`
      const entry: AddonGroceryEntry = {
        id: item.id,
        ingredient_id: item.ingredient_id,
        ingredientName: name,
        foodGroup,
        quantity: item.quantity,
        unit: item.unit,
      }
      const list = groupMap.get(foodGroup) ?? []
      list.push(entry)
      groupMap.set(foodGroup, list)
    }
    return Array.from(groupMap.entries())
      .map(([foodGroup, items]) => ({
        foodGroup,
        items: items.sort((a, b) => a.ingredientName.localeCompare(b.ingredientName)),
      }))
      .sort((a, b) => a.foodGroup.localeCompare(b.foodGroup))
  }, [grocery, ingredientsById])

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

  // Build the lists to render based on the view mode:
  //   - 'everyone'   → one consolidated household total (no double-count).
  //   - 'by-member'  → shared + per-member buckets, with the shop-for subset
  //                    filter (scale shared, filter per-member) applied.
  const filteredLists = useMemo(() => {
    if (!grocery) return []
    if (viewMode === 'everyone') {
      return [aggregateHouseholdGrocery({ lists: grocery.lists })]
    }
    return applyShopForFilter({
      lists: grocery.lists,
      participantIds,
      selectedIds: selectedShopForIds,
    })
  }, [grocery, viewMode, participantIds, selectedShopForIds])

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
            <GroceryViewModePicker mode={viewMode} onChange={setViewMode} />
            {viewMode === 'by-member' && participantIds.length > 0 ? (
              <ShopForPicker
                participantIds={participantIds}
                memberNamesById={memberNamesById}
                selectedIds={selectedShopForIds}
                onChange={setShopForIds}
              />
            ) : null}
            <div className="flex items-start gap-2 rounded-md border border-border bg-card/40 px-4 py-2.5 text-xs text-muted-foreground">
              <Info className="mt-0.5 size-4 shrink-0 text-purchase" aria-hidden />
              <p>
                Quantities are the <strong>full required amounts</strong>. Tap
                the blue dot next to an item to see your pantry stock — you
                decide how much to buy.
              </p>
            </div>
            <div className="flex items-center justify-between gap-3">
              <Label
                htmlFor="collapse-covered"
                className="cursor-pointer text-sm text-muted-foreground"
              >
                Hide lines already covered by pantry
              </Label>
              <Switch
                id="collapse-covered"
                checked={collapseCovered}
                onCheckedChange={setCollapseCovered}
              />
            </div>
            {sortedLists.map((list) => {
              const heading =
                viewMode === 'everyone'
                  ? 'Everyone — whole household'
                  : list.target_member_id === null
                    ? 'Shared'
                    : `Per member: ${
                        memberNamesById[list.target_member_id] ??
                        `[unknown:${list.target_member_id.slice(0, 6)}]`
                      }`
              // (v2.0 §17) Annotate with on-hand pantry stock, then sort by name.
              const sortedItems: AnnotatedGroceryItem[] = annotateWithInventory({
                items: list.scaledItems,
                inventory: onHandInventory,
              }).sort((a, b) => {
                const na =
                  ingredientsById[a.ingredient_id]?.name ?? a.ingredient_id
                const nb =
                  ingredientsById[b.ingredient_id]?.name ?? b.ingredient_id
                return na.localeCompare(nb)
              })
              // (v2.0 parity) Collapse-covered hides fully-covered lines; if a
              // whole list ends up covered, drop the empty card entirely.
              const coveredCount = sortedItems.filter(
                (i) => i.fullyCovered,
              ).length
              const visibleItems = collapseCovered
                ? sortedItems.filter((i) => !i.fullyCovered)
                : sortedItems
              if (collapseCovered && visibleItems.length === 0) return null
              return (
                <Card key={list.id}>
                  <CardHeader className="pb-2">
                    <CardTitle className="flex items-center gap-2 text-base">
                      {heading}
                      {coveredCount > 0 ? (
                        <Badge
                          variant="outline"
                          className="border-success/40 bg-success-tint text-xs text-success"
                        >
                          {coveredCount} covered
                        </Badge>
                      ) : null}
                    </CardTitle>
                    <CardDescription>
                      {sortedItems.length}{' '}
                      {sortedItems.length === 1 ? 'item' : 'items'} — tap an
                      ingredient for freshness rules and which recipes need it.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <div className="divide-y divide-border">
                      {visibleItems.map((item) => {
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
                                        className="size-3.5 shrink-0 text-purchase"
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
                            {/* (v2.0 parity) Pantry coverage — "Covered" badge or
                                a focusable info dot whose popover shows on-hand +
                                suggested buy. The required qty stays the headline
                                number (PRODUCT_PRD §17). */}
                            <PantryInfoDot item={item} name={name} />
                            {item.scheduled_purchase_day ? (
                              <span className="hidden shrink-0 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground sm:inline">
                                {capitalize(item.scheduled_purchase_day)}
                              </span>
                            ) : null}
                            <span className="shrink-0 text-sm font-medium tabular-nums text-foreground">
                              {formatQuantity(qty)} {item.unit}
                            </span>
                          </div>
                        )
                      })}
                      {collapseCovered && coveredCount > 0 ? (
                        <p className="py-2 text-xs text-muted-foreground">
                          {coveredCount} covered item
                          {coveredCount === 1 ? '' : 's'} hidden
                        </p>
                      ) : null}
                    </div>
                  </CardContent>
                </Card>
              )
            })}

            {/* ── v2.1 Addons section (source='addon') ──────────────────────── */}
            {addonGroceryGroups.length > 0 && (
              <>
                <Separator />
                <div className="flex flex-col gap-3">
                  <div className="flex items-center gap-2">
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-addon">
                      Addons
                    </h3>
                    <span className="text-xs text-muted-foreground">
                      Ingredients from addon recipes attached to this menu
                    </span>
                  </div>
                  {addonGroceryGroups.map((group) => (
                    <AddonGroceryGroupCard key={group.foodGroup} group={group} />
                  ))}
                </div>
              </>
            )}
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
