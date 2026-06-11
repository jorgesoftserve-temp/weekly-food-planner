'use client'

import type { ReactNode } from 'react'
import {
  CalendarRange,
  ChefHat,
  LayoutDashboard,
  Package,
  ShoppingCart,
  Users,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { TopbarSearch } from './topbar-search'
import { useLabNav } from './lab-nav'

const NAV = [
  { key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { key: 'recipes', label: 'Recipes', icon: ChefHat },
  { key: 'menu', label: 'Weekly menu', icon: CalendarRange },
  { key: 'grocery', label: 'Grocery', icon: ShoppingCart },
  { key: 'inventory', label: 'Inventory', icon: Package },
  { key: 'members', label: 'Members', icon: Users },
] as const

// Cozy app-shell frame for the mocks: rounded sidebar + soft header. Presentational
// only — `active` just highlights a nav item. Uses the user-accent tint for the
// active item (same idea as the live sidebar, cozier shape).
export const CozyShell = ({
  active,
  title,
  children,
}: {
  active: string
  title: string
  children: ReactNode
}) => {
  const navigate = useLabNav()
  return (
    <div className="flex min-h-[640px] w-full overflow-hidden rounded-2xl border border-border bg-background text-foreground">
      {/* Sidebar */}
      <aside className="hidden w-48 shrink-0 flex-col gap-1 border-r border-border bg-sidebar p-2 md:flex">
        <div className="flex items-center gap-2 px-1.5 py-2.5">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
            <ChefHat className="size-5" />
          </div>
          <div className="flex min-w-0 flex-col leading-tight">
            <span className="truncate text-sm font-semibold">Casa Zapata</span>
            <span className="text-xs text-muted-foreground">Personal</span>
          </div>
        </div>
        <nav className="mt-1 flex flex-col gap-0.5">
          {NAV.map((item) => {
            const Icon = item.icon
            const isActive = item.key === active
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => navigate(item.key)}
                className={cn(
                  'flex items-center gap-2.5 rounded-xl px-2.5 py-2 text-left text-sm font-medium transition',
                  isActive
                    ? 'bg-accent-tint text-accent-strong'
                    : 'text-muted-foreground hover:bg-muted',
                )}
              >
                <Icon className="size-4" />
                {item.label}
              </button>
            )
          })}
        </nav>
      </aside>

      {/* Main */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center gap-3 border-b border-border px-5 py-3">
          <span className="shrink-0 text-base font-semibold">{title}</span>
          <div className="ml-auto flex min-w-0 flex-1 items-center justify-end gap-3">
            <TopbarSearch />
            <button
              type="button"
              onClick={() => navigate('profile')}
              aria-label="Profile & settings"
              className="size-9 shrink-0 rounded-full bg-gradient-to-br from-primary to-secondary"
            />
          </div>
        </header>
        <div className="flex-1 overflow-y-auto p-5">{children}</div>
      </div>
    </div>
  )
}
