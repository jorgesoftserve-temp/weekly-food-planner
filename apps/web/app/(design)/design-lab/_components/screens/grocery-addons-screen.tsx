'use client'

import { useState } from 'react'
import { ChevronDown, ChevronUp, Info, Package, ShoppingCart } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Separator } from '@/components/ui/separator'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { CozyShell } from '../cozy-shell'
import {
  type MockAnnotatedGroceryGroup,
  type MockAnnotatedGroceryItem,
  MOCK_ANNOTATED_GROCERY,
} from '../mock-data'

// ── Mock addon grocery items (source='addon') ─────────────────────────────────
// In the live app these come from grocery_items rows where source='addon',
// grouped by food group. Here they're static mock data representative of two
// attached addons (Guacamole + Salsa roja).
//
// FLAG for design-system-architect: the "Addons" section header uses the same
// purchase-tint as the pantry annotation. A dedicated `--addon` token (teal-ish
// or a green variant) would differentiate the two domain concepts visually.
// Using --purchase-tint as a stand-in for now; no hex is hardcoded.

export type MockAddonGroceryItem = {
  id: string
  name: string
  qty: number
  unit: string
  addonName: string
  foodGroup: string
}

export type MockAddonGroceryGroup = {
  foodGroup: string
  items: MockAddonGroceryItem[]
}

const MOCK_ADDON_GROCERY: MockAddonGroceryGroup[] = [
  {
    foodGroup: 'Produce',
    items: [
      { id: 'ag-a1', name: 'Avocados',       qty: 4,  unit: 'pcs',  addonName: 'Guacamole',  foodGroup: 'Produce' },
      { id: 'ag-a2', name: 'Lime',            qty: 2,  unit: 'pcs',  addonName: 'Guacamole',  foodGroup: 'Produce' },
      { id: 'ag-a3', name: 'Cilantro',        qty: 1,  unit: 'bunch', addonName: 'Guacamole', foodGroup: 'Produce' },
      { id: 'ag-a4', name: 'Roma tomatoes',   qty: 2,  unit: 'pcs',  addonName: 'Salsa roja', foodGroup: 'Produce' },
      { id: 'ag-a5', name: 'Jalapeño',        qty: 1,  unit: 'pcs',  addonName: 'Salsa roja', foodGroup: 'Produce' },
    ],
  },
  {
    foodGroup: 'Pantry',
    items: [
      { id: 'ag-a6', name: 'Salt',   qty: 1, unit: 'pinch', addonName: 'Guacamole', foodGroup: 'Pantry' },
      { id: 'ag-a7', name: 'Cumin',  qty: 1, unit: 'tsp',   addonName: 'Salsa roja', foodGroup: 'Pantry' },
    ],
  },
]

// ── Pantry info dot (reuse same pattern as GroceryPantryScreen) ───────────────

const PantryInfoDot = ({ item }: { item: MockAnnotatedGroceryItem }) => {
  if (item.onHandQty === 0) return null
  if (item.fullyCovered) {
    return (
      <Badge
        variant="outline"
        className="border-success/40 bg-success-tint text-success text-[10px] px-1.5 py-0"
        aria-label={`${item.name} is fully covered by pantry`}
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
          aria-label={`Pantry info for ${item.name}`}
          className="inline-flex items-center justify-center rounded-full text-purchase focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1"
        >
          <Info className="size-3.5" aria-hidden />
        </button>
      </PopoverTrigger>
      <PopoverContent side="top" align="start" className="w-56 px-3 py-2.5 text-xs">
        <p className="font-medium text-foreground">
          You have {item.onHandQty} {item.unit} in your pantry
        </p>
        {item.suggestedToBuy > 0 && (
          <p className="mt-0.5 text-muted-foreground">
            Suggested to buy: {item.suggestedToBuy} {item.unit}
          </p>
        )}
      </PopoverContent>
    </Popover>
  )
}

// ── Standard grocery section (meal-derived lines) ─────────────────────────────
const GrocerySection = ({
  group,
  collapseCovered,
}: {
  group: MockAnnotatedGroceryGroup
  collapseCovered: boolean
}) => {
  const [open, setOpen] = useState(true)
  const coveredCount = group.items.filter((i) => i.fullyCovered).length
  const panelId = `grocery-section-${group.foodGroup.toLowerCase().replace(/\s+/g, '-')}`

  return (
    <div className="flex flex-col gap-0 overflow-hidden rounded-2xl border border-border bg-card cozy-card">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center justify-between px-4 py-3 hover:bg-muted/50"
        aria-expanded={open}
        aria-controls={panelId}
      >
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold">{group.foodGroup}</span>
          {coveredCount > 0 && (
            <Badge variant="outline" className="border-success/40 bg-success-tint text-success text-xs">
              {coveredCount} covered
            </Badge>
          )}
        </div>
        {open ? (
          <ChevronUp className="size-4 text-muted-foreground" aria-hidden />
        ) : (
          <ChevronDown className="size-4 text-muted-foreground" aria-hidden />
        )}
      </button>
      {open && (
        <div id={panelId} className="flex flex-col divide-y divide-border px-4 pb-2">
          {group.items.map((item) => {
            if (collapseCovered && item.fullyCovered) return null
            return (
              <div
                key={item.id}
                className={cn(
                  'flex flex-wrap items-center justify-between gap-x-3 gap-y-1 py-2.5',
                  item.fullyCovered && 'opacity-70',
                )}
              >
                <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-0.5">
                  <span className="text-sm font-medium">{item.name}</span>
                  <PantryInfoDot item={item} />
                </div>
                <span className="shrink-0 text-sm font-semibold tabular-nums">
                  {item.requiredQty} {item.unit}
                </span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── Addon grocery section (source='addon') ────────────────────────────────────
// Visually distinct from meal-derived lines:
//   • Section header uses Package icon + "Addons" label
//   • Each row shows which addon it originates from (addonName chip)
//   • Section container uses purchase-tint border for differentiation
//     (FLAG: replace with --addon token when design-system-architect defines it)

const AddonGrocerySection = ({
  group,
}: {
  group: MockAddonGroceryGroup
}) => {
  const [open, setOpen] = useState(true)
  const panelId = `addon-grocery-${group.foodGroup.toLowerCase().replace(/\s+/g, '-')}`

  return (
    <div className="flex flex-col gap-0 overflow-hidden rounded-2xl border border-purchase/30 bg-purchase-tint/20 cozy-card">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center justify-between px-4 py-3 hover:bg-muted/30"
        aria-expanded={open}
        aria-controls={panelId}
      >
        <div className="flex items-center gap-2">
          <Package className="size-3.5 text-purchase" aria-hidden />
          <span className="text-sm font-semibold text-purchase">{group.foodGroup}</span>
          <Badge variant="outline" className="border-purchase/30 bg-purchase-tint text-purchase text-[10px] px-1.5 py-0">
            addon
          </Badge>
        </div>
        {open ? (
          <ChevronUp className="size-4 text-muted-foreground" aria-hidden />
        ) : (
          <ChevronDown className="size-4 text-muted-foreground" aria-hidden />
        )}
      </button>
      {open && (
        <div id={panelId} className="flex flex-col divide-y divide-border px-4 pb-2">
          {group.items.map((item) => (
            <div
              key={item.id}
              className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 py-2.5"
            >
              <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-0.5">
                <span className="text-sm font-medium">{item.name}</span>
                {/* Addon origin chip */}
                <span className="inline-flex items-center gap-1 rounded-full bg-purchase-tint px-2 py-0.5 text-[10px] font-medium text-purchase border border-purchase/20">
                  <Package className="size-2.5" aria-hidden />
                  {item.addonName}
                </span>
              </div>
              <span className="shrink-0 text-sm font-semibold tabular-nums">
                {item.qty} {item.unit}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Screen ─────────────────────────────────────────────────────────────────────
export const GroceryAddonsScreen = () => {
  const [collapseCovered, setCollapseCovered] = useState(false)

  const totalMealItems = MOCK_ANNOTATED_GROCERY.flatMap((g) => g.items).length
  const totalAddonItems = MOCK_ADDON_GROCERY.flatMap((g) => g.items).length
  const coveredCount = MOCK_ANNOTATED_GROCERY.flatMap((g) =>
    g.items.filter((i) => i.fullyCovered),
  ).length

  // Group addon items by food group for the addon section
  const addonGroupsByFoodGroup = MOCK_ADDON_GROCERY

  return (
    <CozyShell active="grocery" title="Grocery list">
      <div className="flex flex-col gap-5">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-col gap-0.5">
            <h2 className="text-base font-semibold">Grocery list</h2>
            <p className="text-sm text-muted-foreground">
              Week of Jun 9 · {totalMealItems} meal items · {totalAddonItems} addon items
              · {coveredCount} covered by pantry
            </p>
          </div>
          <Button size="sm" variant="outline">
            <ShoppingCart className="size-4" aria-hidden />
            Start shopping
          </Button>
        </div>

        {/* Pantry annotation legend */}
        <div className="flex items-start gap-2 rounded-xl border border-border bg-muted/50 px-3 py-2.5">
          <Info className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
          <p className="text-xs text-muted-foreground">
            Quantities shown are the <strong>full required amounts</strong>. Tap the{' '}
            <Info className="inline size-3 text-purchase" aria-hidden /> blue dot next to an item to
            see your pantry stock. Addon items (
            <Package className="inline size-3 text-purchase" aria-hidden />) appear in a separate section
            below the meal-derived lines.
          </p>
        </div>

        {/* Collapse toggle */}
        <div className="flex items-center justify-between gap-3">
          <label htmlFor="collapse-covered-addons" className="cursor-pointer text-sm text-muted-foreground">
            Collapse fully-covered lines
          </label>
          <Switch
            id="collapse-covered-addons"
            checked={collapseCovered}
            onCheckedChange={(checked) => setCollapseCovered(checked)}
          />
        </div>

        {/* ── Meal-derived lines ──────────────────────────────────────────── */}
        <div className="flex flex-col gap-1">
          <h3 className="px-0.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            From meals
          </h3>
          <div className="flex flex-col gap-3">
            {MOCK_ANNOTATED_GROCERY.map((group) => (
              <GrocerySection
                key={group.foodGroup}
                group={group}
                collapseCovered={collapseCovered}
              />
            ))}
          </div>
        </div>

        <Separator />

        {/* ── v2.1 NEW — Addons section (source='addon') ─────────────────── */}
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2 px-0.5">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-purchase">
              Addons
            </h3>
            <Badge
              variant="outline"
              className="border-purchase/30 bg-purchase-tint text-purchase text-[10px] px-1.5 py-0"
            >
              v2.1 new
            </Badge>
            <span className="text-xs text-muted-foreground">
              Ingredients from addon recipes attached to this menu
            </span>
          </div>

          {addonGroupsByFoodGroup.length === 0 ? (
            <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-border bg-muted/30 py-8 text-center">
              <Package className="size-5 text-muted-foreground" aria-hidden />
              <p className="text-sm font-medium">No addon ingredients</p>
              <p className="text-xs text-muted-foreground">
                Attach addon recipes to the menu to see their ingredients here.
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {addonGroupsByFoodGroup.map((group) => (
                <AddonGrocerySection key={group.foodGroup} group={group} />
              ))}
            </div>
          )}
        </div>
      </div>
    </CozyShell>
  )
}
