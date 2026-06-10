'use client'

import Link from 'next/link'
import { CalendarRange, ChefHat, Plus, Sparkles } from 'lucide-react'

// Onboarding / zero-state shown when there is no active menu.
// Keeps the spirit of the previous quick-links layout while fitting the
// cozy token vocabulary (rounded-2xl, shadow-md, bg-gradient-empty).
export const DashboardEmpty = () => (
  <div className="flex flex-col gap-4">
    <div className="rounded-2xl border border-dashed border-border bg-card p-6 bg-gradient-empty shadow-sm">
      <div className="flex flex-col items-start gap-4">
        <div className="flex size-12 items-center justify-center rounded-2xl bg-accent-tint text-accent-strong">
          <CalendarRange className="size-6" aria-hidden="true" />
        </div>
        <div className="flex flex-col gap-1">
          <h3 className="font-semibold">No active menu yet</h3>
          <p className="text-sm text-muted-foreground">
            Add a few recipes, then generate your first weekly plan. The
            planner builds a deterministic menu from your ingredients and
            dietary constraints — same inputs, same plan every time.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/menu"
            className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm transition-opacity hover:opacity-90"
          >
            <Sparkles className="size-4" />
            Generate your first menu
          </Link>
          <Link
            href="/recipes"
            className="inline-flex items-center gap-2 rounded-full border border-border bg-background px-4 py-2 text-sm font-medium transition-colors hover:bg-muted"
          >
            <Plus className="size-4" />
            Add recipes
          </Link>
        </div>
      </div>
    </div>

    {/* Quick navigation cards */}
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {QUICK_LINKS.map((link) => {
        const Icon = link.icon
        return (
          <Link
            key={link.href}
            href={link.href}
            className="hover-lift flex flex-col items-start gap-3 rounded-2xl border border-border bg-card p-5 shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <div className="flex size-10 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
              <Icon className="size-5" aria-hidden="true" />
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-sm font-semibold">{link.title}</span>
              <span className="text-xs text-muted-foreground">
                {link.description}
              </span>
            </div>
          </Link>
        )
      })}
    </div>
  </div>
)

const QUICK_LINKS = [
  {
    href: '/recipes',
    title: 'Recipes',
    description: 'Build the pool the generator picks from.',
    icon: ChefHat,
  },
  {
    href: '/menu',
    title: 'Weekly menu',
    description: 'Generate a deterministic plan for the week.',
    icon: CalendarRange,
  },
  {
    href: '/members',
    title: 'Members',
    description: 'Add household members with their own dietary profiles.',
    icon: Plus,
  },
] as const
