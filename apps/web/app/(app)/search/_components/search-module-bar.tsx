'use client'

import {
  CalendarRange,
  ChefHat,
  ShoppingCart,
  Users,
  type LucideIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils'

// The cross-module search surface starts Recipes-first (v1.9). The bar is built
// to extend to the other modules later — they render here as disabled segments
// with a "Soon" hint so the shape is visible without promising behaviour.
export type SearchModule = 'recipes' | 'menu' | 'grocery' | 'members'

const MODULES: Array<{
  key: SearchModule
  label: string
  icon: LucideIcon
  enabled: boolean
}> = [
  { key: 'recipes', label: 'Recipes', icon: ChefHat, enabled: true },
  { key: 'menu', label: 'Weekly menu', icon: CalendarRange, enabled: false },
  { key: 'grocery', label: 'Grocery', icon: ShoppingCart, enabled: false },
  { key: 'members', label: 'Members', icon: Users, enabled: false },
]

type SearchModuleBarProps = {
  active: SearchModule
  onSelect: ({ module }: { module: SearchModule }) => void
}

export const SearchModuleBar = ({ active, onSelect }: SearchModuleBarProps) => {
  return (
    <div
      role="tablist"
      aria-label="Search in"
      className="flex flex-wrap gap-2"
    >
      {MODULES.map((m) => {
        const Icon = m.icon
        const isActive = m.key === active
        return (
          <button
            key={m.key}
            type="button"
            role="tab"
            aria-selected={isActive}
            disabled={!m.enabled}
            onClick={() => m.enabled && onSelect({ module: m.key })}
            className={cn(
              'inline-flex items-center gap-2 rounded-pill px-3.5 py-2 text-sm font-medium transition-colors',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
              isActive
                ? 'bg-accent-tint text-accent-strong'
                : 'border border-border text-muted-foreground hover:bg-muted',
              !m.enabled && 'cursor-not-allowed opacity-60 hover:bg-transparent',
            )}
          >
            <Icon className="size-4" aria-hidden />
            {m.label}
            {!m.enabled ? (
              <span className="rounded-pill bg-muted px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                Soon
              </span>
            ) : null}
          </button>
        )
      })}
    </div>
  )
}
