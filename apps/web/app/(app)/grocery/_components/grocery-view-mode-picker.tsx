'use client'

import { LayoutList, Users } from 'lucide-react'
import { cn } from '@/lib/utils'

export type GroceryViewMode = 'everyone' | 'by-member'

export type GroceryViewModePickerProps = {
  mode: GroceryViewMode
  onChange: (mode: GroceryViewMode) => void
}

// (v2.0 item 8) Toggles the grocery list between a single consolidated
// "Everyone / whole household" total and the per-member breakdown (which also
// hosts the shop-for-subset picker). Mirrors the design-lab grocery-pantry
// ViewModePicker.
export const GroceryViewModePicker = ({
  mode,
  onChange,
}: GroceryViewModePickerProps) => (
  <div className="flex flex-col gap-2">
    <span className="text-xs font-medium text-muted-foreground">View</span>
    <div
      className="flex flex-wrap gap-2"
      role="radiogroup"
      aria-label="Grocery view mode"
    >
      <button
        type="button"
        role="radio"
        onClick={() => onChange('everyone')}
        aria-checked={mode === 'everyone'}
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
        role="radio"
        onClick={() => onChange('by-member')}
        aria-checked={mode === 'by-member'}
        className={cn(
          'inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-medium transition',
          mode === 'by-member'
            ? 'bg-accent-tint text-accent-strong'
            : 'border border-border text-muted-foreground hover:bg-muted',
        )}
      >
        <LayoutList className="size-3.5" aria-hidden />
        By member
      </button>
    </div>
  </div>
)
