'use client'

import { useState } from 'react'
import { ChevronDown, ChevronUp, Info, ShoppingCart, Users } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { CozyShell } from '../cozy-shell'
import {
  type AccentKey,
  type MockAnnotatedGroceryGroup,
  type MockAnnotatedGroceryItem,
  MOCK_ANNOTATED_GROCERY,
  MOCK_MEMBER_GROCERY,
  MOCK_MEMBERS,
  memberAccentStyle,
  memberDotStyle,
} from '../mock-data'

// ── Pantry info dot + popover (CHANGE #4) ─────────────────────────────────────
// Replaces the old inline "· you have X · suggested: Y" text and the right-column
// "Suggested: N". A small blue info indicator appears next to the item name when
// on-hand stock > 0; clicking opens a Popover with the detail. Fully-covered items
// show a compact "Covered" badge instead of the indicator.

const PantryInfoDot = ({ item }: { item: MockAnnotatedGroceryItem }) => {
  if (item.onHandQty === 0) return null

  // Fully covered: show "Covered" badge, no popover needed
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

  // Partial coverage: blue info dot that opens a popover
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={`Pantry info for ${item.name}`}
          className={cn(
            'inline-flex items-center justify-center rounded-full text-purchase',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1',
          )}
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

// ── Annotated grocery row ─────────────────────────────────────────────────────
// CHANGE #4: no inline annotation text, no right-column "Suggested: N".
// Full required quantity is the headline. Blue dot for partial coverage; Covered badge for full.
const AnnotatedRow = ({
  item,
  collapsed,
}: {
  item: MockAnnotatedGroceryItem
  collapsed: boolean
}) => {
  if (collapsed && item.fullyCovered) return null

  return (
    <div
      className={cn(
        'flex flex-wrap items-center justify-between gap-x-3 gap-y-1 py-2.5',
        item.fullyCovered && 'opacity-70',
      )}
    >
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-0.5">
        <span className="text-sm font-medium">{item.name}</span>
        {/* Pantry info dot — keyboard-focusable, aria-labelled */}
        <PantryInfoDot item={item} />
      </div>
      {/* Full required quantity is always the headline number */}
      <span className="shrink-0 text-sm font-semibold tabular-nums">
        {item.requiredQty} {item.unit}
      </span>
    </div>
  )
}

// ── Food group section ────────────────────────────────────────────────────────
const GrocerySection = ({
  group,
  collapseCovered,
}: {
  group: MockAnnotatedGroceryGroup
  collapseCovered: boolean
}) => {
  const [open, setOpen] = useState(true)
  const coveredCount = group.items.filter((i) => i.fullyCovered).length
  const visibleItems = collapseCovered
    ? group.items.filter((i) => !i.fullyCovered)
    : group.items

  if (collapseCovered && visibleItems.length === 0) return null

  const panelId = `grocery-group-${group.foodGroup.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')}`

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
            <Badge
              variant="outline"
              className="border-success/40 bg-success-tint text-success text-xs"
            >
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
          {group.items.map((item) => (
            <AnnotatedRow key={item.id} item={item} collapsed={collapseCovered} />
          ))}
          {collapseCovered && coveredCount > 0 && (
            <p className="py-2 text-xs text-muted-foreground">
              {coveredCount} covered item{coveredCount > 1 ? 's' : ''} hidden
            </p>
          )}
        </div>
      )}
    </div>
  )
}

// ── View mode picker ──────────────────────────────────────────────────────────
type ViewMode = 'everyone' | 'by-member' | string

const ViewModePicker = ({
  mode,
  onSelect,
}: {
  mode: ViewMode
  onSelect: ({ mode }: { mode: ViewMode }) => void
}) => (
  <div className="flex flex-col gap-2">
    <span className="text-xs font-medium text-muted-foreground">View</span>
    <div className="flex flex-wrap gap-2" role="group" aria-label="Grocery view mode">
      <button
        type="button"
        onClick={() => onSelect({ mode: 'everyone' })}
        aria-pressed={mode === 'everyone'}
        className={cn(
          'inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-medium transition',
          mode === 'everyone'
            ? 'bg-accent-tint text-accent-strong'
            : 'border border-border text-muted-foreground hover:bg-muted',
        )}
      >
        <Users className="size-3.5" aria-hidden />
        Everyone
      </button>

      <button
        type="button"
        onClick={() => onSelect({ mode: 'by-member' })}
        aria-pressed={mode === 'by-member'}
        className={cn(
          'inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-medium transition',
          mode === 'by-member'
            ? 'bg-accent-tint text-accent-strong'
            : 'border border-border text-muted-foreground hover:bg-muted',
        )}
      >
        By member
      </button>

      {MOCK_MEMBERS.map((m) => (
        <button
          key={m.id}
          type="button"
          onClick={() => onSelect({ mode: m.id })}
          aria-pressed={mode === m.id}
          className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm font-medium transition"
          style={mode === m.id ? memberAccentStyle(m.accent as AccentKey) : undefined}
        >
          <span
            className="size-2 rounded-full"
            aria-hidden
            style={memberDotStyle(m.accent as AccentKey)}
          />
          {m.name.split(' ')[0]}
        </button>
      ))}
    </div>
  </div>
)

// ── By-member view ────────────────────────────────────────────────────────────
const MemberGroceryView = ({ collapseCovered }: { collapseCovered: boolean }) => (
  <div className="flex flex-col gap-4">
    {MOCK_MEMBER_GROCERY.map((memberRow) => (
      <div key={memberRow.memberId} className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <span
            className="size-2 rounded-full"
            aria-hidden
            style={memberDotStyle(memberRow.accent)}
          />
          <span className="text-sm font-semibold">{memberRow.memberName}</span>
        </div>
        <div className="overflow-hidden rounded-2xl border border-border bg-card cozy-card">
          <div className="flex flex-col divide-y divide-border px-4 py-2">
            {memberRow.items
              .filter((i) => !collapseCovered || !i.fullyCovered)
              .map((item) => (
                <AnnotatedRow key={item.id} item={item} collapsed={collapseCovered} />
              ))}
            {collapseCovered &&
              memberRow.items.filter((i) => i.fullyCovered).length > 0 && (
                <p className="py-2 text-xs text-muted-foreground">
                  {memberRow.items.filter((i) => i.fullyCovered).length} covered item(s) hidden
                </p>
              )}
          </div>
        </div>
      </div>
    ))}
  </div>
)

// ── Screen ────────────────────────────────────────────────────────────────────
export const GroceryPantryScreen = () => {
  const [viewMode, setViewMode] = useState<ViewMode>('everyone')
  const [collapseCovered, setCollapseCovered] = useState(false)

  const selectedMember = MOCK_MEMBERS.find((m) => m.id === viewMode)

  let displayedGroups: MockAnnotatedGroceryGroup[] = MOCK_ANNOTATED_GROCERY
  if (selectedMember) {
    const memberRow = MOCK_MEMBER_GROCERY.find((r) => r.memberId === viewMode)
    if (memberRow) {
      const grouped = new Map<string, MockAnnotatedGroceryItem[]>()
      for (const item of memberRow.items) {
        const existing = grouped.get(item.foodGroup) ?? []
        grouped.set(item.foodGroup, [...existing, item])
      }
      displayedGroups = [...grouped.entries()].map(([foodGroup, items]) => ({
        foodGroup,
        items,
      }))
    } else {
      displayedGroups = []
    }
  }

  const totalRequired = MOCK_ANNOTATED_GROCERY.flatMap((g) => g.items).length
  const coveredCount = MOCK_ANNOTATED_GROCERY.flatMap((g) =>
    g.items.filter((i) => i.fullyCovered),
  ).length

  const showByMember = viewMode === 'by-member'
  const showMemberEmpty = !!selectedMember && displayedGroups.length === 0

  return (
    <CozyShell active="grocery" title="Grocery list">
      <div className="flex flex-col gap-5">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-col gap-0.5">
            <h2 className="text-base font-semibold">Grocery list</h2>
            <p className="text-sm text-muted-foreground">
              Week of Jun 9 · {totalRequired} items · {coveredCount} fully covered by pantry
            </p>
          </div>
          <Button size="sm" variant="outline">
            <ShoppingCart className="size-4" aria-hidden />
            Start shopping
          </Button>
        </div>

        {/* View mode picker */}
        <ViewModePicker mode={viewMode} onSelect={({ mode }) => setViewMode(mode)} />

        {/* Pantry annotation legend — explains the blue info dot */}
        <div className="flex items-start gap-2 rounded-xl border border-border bg-muted/50 px-3 py-2.5">
          <Info className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
          <p className="text-xs text-muted-foreground">
            Quantities shown are the <strong>full required amounts</strong>. Tap the{' '}
            <Info className="inline size-3 text-purchase" aria-hidden /> blue dot next to an item to
            see your pantry stock — you decide how much to buy.
          </p>
        </div>

        {/* Collapse toggle */}
        <div className="flex items-center justify-between gap-3">
          <label htmlFor="collapse-covered" className="cursor-pointer text-sm text-muted-foreground">
            Collapse fully-covered lines
          </label>
          <Switch
            id="collapse-covered"
            checked={collapseCovered}
            onCheckedChange={(checked) => setCollapseCovered(checked)}
          />
        </div>

        {/* Grocery list */}
        {showByMember ? (
          <MemberGroceryView collapseCovered={collapseCovered} />
        ) : showMemberEmpty ? (
          <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border bg-gradient-empty py-12 text-center">
            <div className="rounded-full bg-muted p-3 text-muted-foreground">
              <ShoppingCart className="size-5" aria-hidden />
            </div>
            <p className="text-sm font-medium">
              No grocery items for {selectedMember.name.split(' ')[0]}
            </p>
            <p className="text-xs text-muted-foreground">
              This member has no items assigned for this week.
            </p>
          </div>
        ) : displayedGroups.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border bg-gradient-empty py-12 text-center">
            <div className="rounded-full bg-muted p-3 text-muted-foreground">
              <ShoppingCart className="size-5" aria-hidden />
            </div>
            <p className="text-sm font-medium">No grocery items</p>
            <p className="text-xs text-muted-foreground">Accept a menu to generate a grocery list.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {displayedGroups.map((group) => (
              <GrocerySection
                key={group.foodGroup}
                group={group}
                collapseCovered={collapseCovered}
              />
            ))}
          </div>
        )}
      </div>
    </CozyShell>
  )
}
