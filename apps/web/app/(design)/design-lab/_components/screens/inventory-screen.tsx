'use client'

import { useRef, useState } from 'react'
import {
  AlertTriangle,
  Box,
  Calendar,
  Carrot,
  Minus,
  Package,
  Plus,
  ShoppingBag,
  Trash2,
  Utensils,
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
  SheetTrigger,
} from '@/components/ui/sheet'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { CozyShell } from '../cozy-shell'
import {
  type InventorySource,
  type MockInventoryItem,
  MOCK_INVENTORY,
  SOURCE_DISPLAY_LABEL,
} from '../mock-data'

// ── Source badge ──────────────────────────────────────────────────────────────
// CHANGE #5: labels now Pantry / Menu / Leftover (internal keys unchanged).
// CHANGE #7: Pantry (manual) uses badge-neutral for contrast; Menu uses
// purchase-tint; Leftover stays amber/warning.

const SOURCE_CONFIG: Record<
  InventorySource,
  { icon: typeof Box; badgeClass: string }
> = {
  manual: {
    icon: Box,
    // badge-neutral = bg-tag-neutral-tint border-tag-neutral-border text-tag-neutral
    // Applied as a single utility class defined in design-lab.css
    badgeClass: 'badge-neutral',
  },
  purchase: {
    icon: ShoppingBag,
    badgeClass: 'bg-purchase-tint text-purchase border-purchase/30',
  },
  leftover: {
    icon: Utensils,
    badgeClass: 'bg-warning-tint text-warning border-transparent',
  },
  // Phase-5 raw-ingredient remainder: shows as Pantry badge (same neutral style
  // as manual) but with Carrot icon to distinguish from fully manual entries.
  cook_remainder: {
    icon: Carrot,
    badgeClass: 'badge-neutral',
  },
}

const SourceBadge = ({ source }: { source: InventorySource }) => {
  const cfg = SOURCE_CONFIG[source]
  const Icon = cfg.icon
  return (
    <Badge
      variant="outline"
      className={cn(
        'gap-1 rounded-pill text-xs font-medium px-2 py-0.5',
        cfg.badgeClass,
      )}
    >
      <Icon className="size-3" aria-hidden />
      {SOURCE_DISPLAY_LABEL[source]}
    </Badge>
  )
}

// ── Near-expiry treatment ─────────────────────────────────────────────────────
const ExpiryLabel = ({
  date,
  nearExpiry,
}: {
  date?: string
  nearExpiry?: boolean
}) => {
  if (!date) return <span className="text-xs text-muted-foreground">No expiry</span>
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 text-xs font-medium',
        nearExpiry ? 'text-warning' : 'text-muted-foreground',
      )}
    >
      {nearExpiry ? <AlertTriangle className="size-3" aria-hidden /> : <Calendar className="size-3" aria-hidden />}
      {nearExpiry && <span className="sr-only">Expiring soon — </span>}
      {date}
    </span>
  )
}

// ── Decrement affordance ──────────────────────────────────────────────────────
const DecrementControl = ({
  item,
  onDecrement,
  onIncrement,
}: {
  item: MockInventoryItem
  onDecrement: ({ id }: { id: string }) => void
  onIncrement: ({ id }: { id: string }) => void
}) => (
  <div className="flex items-center gap-1.5">
    <button
      type="button"
      aria-label={`Decrease quantity of ${item.ingredient}`}
      onClick={() => onDecrement({ id: item.id })}
      className={cn(
        'flex size-6 items-center justify-center rounded-full border border-border bg-background text-muted-foreground hover:bg-muted',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
      )}
    >
      <Minus className="size-3" aria-hidden />
    </button>
    <span className="min-w-[3rem] text-center text-sm font-medium tabular-nums">
      {item.quantity} {item.unit}
    </span>
    <button
      type="button"
      aria-label={`Increase quantity of ${item.ingredient}`}
      onClick={() => onIncrement({ id: item.id })}
      className={cn(
        'flex size-6 items-center justify-center rounded-full border border-border bg-background text-muted-foreground hover:bg-muted',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
      )}
    >
      <Plus className="size-3" aria-hidden />
    </button>
  </div>
)

// Derive the effective display source for a purchase item that has graduated
// to Pantry (its menu week has ended). A graduated item shows the Pantry badge
// instead of Menu, plus a subtle note. This is a read-side derivation only.
const effectiveSource = (item: MockInventoryItem): InventorySource =>
  item.source === 'purchase' && item.graduatedNote ? 'manual' : item.source

// ── Inventory row ─────────────────────────────────────────────────────────────
const InventoryRow = ({
  item,
  onDecrement,
  onIncrement,
  onMarkConsumed,
}: {
  item: MockInventoryItem
  onDecrement: ({ id }: { id: string }) => void
  onIncrement: ({ id }: { id: string }) => void
  onMarkConsumed: ({ id }: { id: string }) => void
}) => {
  const displaySource = effectiveSource(item)
  return (
  <li
    className={cn(
      'flex flex-col gap-2 rounded-xl border border-border bg-card p-3 sm:flex-row sm:items-center sm:gap-4',
      item.nearExpiry && 'border-warning/40 bg-warning-tint/30',
    )}
  >
    {/* Name + source + meal ref */}
    <div className="flex min-w-0 flex-1 flex-col gap-1">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium">{item.ingredient}</span>
        <SourceBadge source={displaySource} />
        {item.nearExpiry && (
          <Badge
            variant="outline"
            className="gap-1 border-warning/40 bg-warning-tint text-warning text-xs"
          >
            <AlertTriangle className="size-3" aria-hidden />
            <span aria-hidden>Expiring soon</span>
          </Badge>
        )}
      </div>
      {/* Phase-5: cook-remainder provenance line */}
      {item.provenanceNote && (
        <span className="text-xs text-muted-foreground italic">{item.provenanceNote}</span>
      )}
      {/* Phase-1: graduated Menu→Pantry note */}
      {item.graduatedNote && (
        <span className="text-xs text-muted-foreground">{item.graduatedNote}</span>
      )}
      {/* Regular source meal reference (only when no provenance/graduated note) */}
      {item.sourceMealName && !item.provenanceNote && !item.graduatedNote && (
        <span className="text-xs text-muted-foreground">From: {item.sourceMealName}</span>
      )}
    </div>

    {/* Expiry */}
    <div className="shrink-0">
      <ExpiryLabel date={item.expirationDate} nearExpiry={item.nearExpiry} />
    </div>

    {/* Qty stepper */}
    <div className="shrink-0">
      <DecrementControl item={item} onDecrement={onDecrement} onIncrement={onIncrement} />
    </div>

    {/* Zero-quantity: surface "Mark as consumed" inline affordance */}
    {item.quantity === 0 ? (
      <button
        type="button"
        onClick={() => onMarkConsumed({ id: item.id })}
        aria-label={`Mark ${item.ingredient} as consumed`}
        className={cn(
          'shrink-0 rounded-full border border-border px-2.5 py-0.5 text-xs font-medium text-muted-foreground hover:border-destructive hover:text-destructive transition',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
        )}
      >
        Mark as consumed
      </button>
    ) : (
      <button
        type="button"
        aria-label={`Mark ${item.ingredient} as consumed`}
        onClick={() => onMarkConsumed({ id: item.id })}
        className={cn(
          'shrink-0 text-muted-foreground hover:text-destructive',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
        )}
      >
        <Trash2 className="size-4" aria-hidden />
      </button>
    )}
  </li>
  )
}

// ── Source filter group ───────────────────────────────────────────────────────
// CHANGE #5: filter labels updated to Pantry / Menu / Leftover.
// `cook_remainder` items are grouped under the 'Pantry' filter because they
// display as 'Pantry' to the user (raw stock, not a cooked-food leftover).
type FilterKey = 'all' | 'pantry' | 'purchase' | 'leftover'
const FILTERS: { key: FilterKey; label: string }[] = [
  { key: 'all',      label: 'All' },
  { key: 'pantry',   label: 'Pantry' },
  { key: 'purchase', label: 'Menu' },
  { key: 'leftover', label: 'Leftover' },
]

const itemMatchesFilter = (item: MockInventoryItem, filter: FilterKey): boolean => {
  if (filter === 'all') return true
  if (filter === 'pantry') return item.source === 'manual' || item.source === 'cook_remainder'
  // Graduated purchase items (graduatedNote set) now show under Pantry filter
  if (filter === 'purchase') return item.source === 'purchase' && !item.graduatedNote
  if (filter === 'leftover') return item.source === 'leftover'
  return false
}

// ── Add Item Sheet (CHANGE #1) ────────────────────────────────────────────────
// A shadcn Sheet with ingredient name, quantity, unit, optional expiry date,
// and source selector (default: Pantry/manual). On submit, prepends new item
// to the local inventory list so the interaction is immediately visible.

type AddItemFormState = {
  ingredient: string
  quantity: string
  unit: string
  expirationDate: string
  source: InventorySource
}

const INITIAL_FORM: AddItemFormState = {
  ingredient: '',
  quantity: '',
  unit: 'pcs',
  expirationDate: '',
  source: 'manual',
}

const UNIT_OPTIONS = ['pcs', 'g', 'kg', 'ml', 'L', 'cup', 'tbsp', 'tsp', 'bag', 'can', 'servings']

const AddItemSheet = ({
  onAdd,
}: {
  onAdd: ({ item }: { item: MockInventoryItem }) => void
}) => {
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState<AddItemFormState>(INITIAL_FORM)
  const [errors, setErrors] = useState<Partial<Record<keyof AddItemFormState, string>>>({})
  // Ref to move focus into the sheet on open
  const firstInputRef = useRef<HTMLInputElement>(null)

  const validate = (): boolean => {
    const next: typeof errors = {}
    if (!form.ingredient.trim()) next.ingredient = 'Ingredient name is required'
    if (!form.quantity.trim() || Number.isNaN(Number(form.quantity)) || Number(form.quantity) <= 0) {
      next.quantity = 'Enter a valid positive quantity'
    }
    setErrors(next)
    return Object.keys(next).length === 0
  }

  const handleSubmit = () => {
    if (!validate()) return
    const newItem: MockInventoryItem = {
      id: `inv-new-${Date.now()}`,
      ingredient: form.ingredient.trim(),
      quantity: Number(form.quantity),
      unit: form.unit,
      source: form.source,
      expirationDate: form.expirationDate || undefined,
      isConsumed: false,
    }
    onAdd({ item: newItem })
    setForm(INITIAL_FORM)
    setErrors({})
    setOpen(false)
  }

  const setField = <K extends keyof AddItemFormState>(key: K, value: AddItemFormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }))
    if (errors[key]) setErrors((prev) => ({ ...prev, [key]: undefined }))
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button size="sm">
          <Plus className="size-4" aria-hidden />
          Add item
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="flex w-full flex-col gap-0 sm:max-w-md">
        <SheetHeader className="pb-4">
          <SheetTitle>Add inventory item</SheetTitle>
          <SheetDescription>
            Add an ingredient to your pantry. It will appear in your inventory immediately.
          </SheetDescription>
        </SheetHeader>

        <div className="flex flex-1 flex-col gap-5 overflow-y-auto py-2">
          {/* Ingredient name */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="add-ingredient">
              Ingredient <span aria-hidden className="text-destructive">*</span>
            </Label>
            <Input
              id="add-ingredient"
              ref={firstInputRef}
              placeholder="e.g. Roma tomatoes"
              value={form.ingredient}
              onChange={(e) => setField('ingredient', e.target.value)}
              aria-invalid={!!errors.ingredient}
              aria-describedby={errors.ingredient ? 'add-ingredient-error' : undefined}
              autoFocus
            />
            {errors.ingredient && (
              <p id="add-ingredient-error" className="text-xs text-destructive" role="alert">
                {errors.ingredient}
              </p>
            )}
          </div>

          {/* Quantity + unit side by side */}
          <div className="flex gap-3">
            <div className="flex flex-1 flex-col gap-1.5">
              <Label htmlFor="add-quantity">
                Quantity <span aria-hidden className="text-destructive">*</span>
              </Label>
              <Input
                id="add-quantity"
                type="number"
                min="0"
                step="any"
                placeholder="e.g. 4"
                value={form.quantity}
                onChange={(e) => setField('quantity', e.target.value)}
                aria-invalid={!!errors.quantity}
                aria-describedby={errors.quantity ? 'add-quantity-error' : undefined}
              />
              {errors.quantity && (
                <p id="add-quantity-error" className="text-xs text-destructive" role="alert">
                  {errors.quantity}
                </p>
              )}
            </div>
            <div className="flex w-32 flex-col gap-1.5">
              <Label htmlFor="add-unit">Unit</Label>
              <Select value={form.unit} onValueChange={(v) => setField('unit', v)}>
                <SelectTrigger id="add-unit">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {UNIT_OPTIONS.map((u) => (
                    <SelectItem key={u} value={u}>
                      {u}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Expiration date (optional) */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="add-expiry">Expiration date (optional)</Label>
            <Input
              id="add-expiry"
              type="date"
              value={form.expirationDate}
              onChange={(e) => setField('expirationDate', e.target.value)}
            />
          </div>

          {/* Source selector — default Pantry */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="add-source">Source</Label>
            <Select
              value={form.source}
              onValueChange={(v) => setField('source', v as InventorySource)}
            >
              <SelectTrigger id="add-source">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(SOURCE_DISPLAY_LABEL) as InventorySource[]).map((key) => (
                  <SelectItem key={key} value={key}>
                    {SOURCE_DISPLAY_LABEL[key]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <SheetFooter className="flex-row gap-2 pt-4">
          <Button
            variant="outline"
            className="flex-1"
            onClick={() => {
              setForm(INITIAL_FORM)
              setErrors({})
              setOpen(false)
            }}
          >
            Cancel
          </Button>
          <Button className="flex-1" onClick={handleSubmit}>
            Add to inventory
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}

// ── Screen ────────────────────────────────────────────────────────────────────
export const InventoryScreen = () => {
  const [items, setItems] = useState<MockInventoryItem[]>(MOCK_INVENTORY)
  const [filter, setFilter] = useState<FilterKey>('all')

  const visible = items.filter((i) => itemMatchesFilter(i, filter))
  const nearExpiryCount = items.filter((i) => i.nearExpiry && !i.isConsumed).length

  const handleDecrement = ({ id }: { id: string }) => {
    setItems((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, quantity: Math.max(0, item.quantity - 1) } : item,
      ),
    )
  }

  const handleIncrement = ({ id }: { id: string }) => {
    setItems((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, quantity: item.quantity + 1 } : item,
      ),
    )
  }

  const handleMarkConsumed = ({ id }: { id: string }) => {
    setItems((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, isConsumed: true, quantity: 0 } : item,
      ),
    )
  }

  // CHANGE #1: prepend new item to the list
  const handleAddItem = ({ item }: { item: MockInventoryItem }) => {
    setItems((prev) => [item, ...prev])
  }

  // Exclude consumed items from the visible list
  const visibleActive = visible.filter((i) => !i.isConsumed)

  return (
    <CozyShell active="inventory" title="Inventory">
      <div className="flex flex-col gap-5">
        {/* Header row */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-col gap-0.5">
            <h2 className="text-base font-semibold">Pantry</h2>
            <p className="text-sm text-muted-foreground">
              {items.filter((i) => !i.isConsumed).length} items on hand
              {nearExpiryCount > 0 && (
                <span className="ml-1.5 inline-flex items-center gap-1 text-warning">
                  · <AlertTriangle className="size-3.5" aria-hidden />{' '}
                  {nearExpiryCount} expiring soon
                </span>
              )}
            </p>
          </div>
          {/* CHANGE #1: sheet trigger replaces plain button */}
          <AddItemSheet onAdd={handleAddItem} />
        </div>

        {/* Source filter — role="group" + aria-pressed. CHANGE #5: labels Pantry/Menu/Leftover */}
        <div className="flex flex-wrap gap-2" role="group" aria-label="Filter by source">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              type="button"
              aria-pressed={filter === f.key}
              onClick={() => setFilter(f.key)}
              className={cn(
                'rounded-full px-3.5 py-1 text-sm font-medium transition',
                filter === f.key
                  ? 'bg-accent-tint text-accent-strong'
                  : 'border border-border text-muted-foreground hover:bg-muted',
              )}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Item list */}
        {visibleActive.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border bg-gradient-empty py-12 text-center">
            <div className="rounded-full bg-muted p-3 text-muted-foreground">
              <Package className="size-5" aria-hidden />
            </div>
            <div className="flex flex-col gap-1">
              <p className="text-sm font-medium">No items in this category</p>
              <p className="text-xs text-muted-foreground">
                Add items manually or finalize a shopping session to populate inventory.
              </p>
            </div>
            <AddItemSheet onAdd={handleAddItem} />
          </div>
        ) : (
          <ul className="flex flex-col gap-2" aria-label="Inventory items">
            {visibleActive.map((item) => (
              <InventoryRow
                key={item.id}
                item={item}
                onDecrement={handleDecrement}
                onIncrement={handleIncrement}
                onMarkConsumed={handleMarkConsumed}
              />
            ))}
          </ul>
        )}
      </div>
    </CozyShell>
  )
}
