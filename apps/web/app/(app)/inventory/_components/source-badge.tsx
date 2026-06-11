'use client'

import { Box, ShoppingBag, Utensils } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import type { InventoryDisplayTag } from '@weekly-food-planner/supabase'

// Maps the derived display tag (pantry / menu / leftover) to visual config.
// "pantry" covers both manual additions and graduated purchase items.
// "menu" is a purchase item whose source menu week is still current.
// "leftover" is a leftover item.
const TAG_CONFIG: Record<
  InventoryDisplayTag,
  { icon: typeof Box; label: string; badgeClass: string }
> = {
  pantry: {
    icon: Box,
    label: 'Pantry',
    badgeClass:
      'bg-muted text-muted-foreground border-border',
  },
  menu: {
    icon: ShoppingBag,
    label: 'Menu',
    badgeClass:
      'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800',
  },
  leftover: {
    icon: Utensils,
    label: 'Leftover',
    badgeClass:
      'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800',
  },
}

export const SourceBadge = ({ tag }: { tag: InventoryDisplayTag }) => {
  const cfg = TAG_CONFIG[tag]
  const Icon = cfg.icon
  return (
    <Badge
      variant="outline"
      className={cn(
        'gap-1 rounded-full text-xs font-medium px-2 py-0.5',
        cfg.badgeClass,
      )}
    >
      <Icon className="size-3" aria-hidden />
      {cfg.label}
    </Badge>
  )
}
