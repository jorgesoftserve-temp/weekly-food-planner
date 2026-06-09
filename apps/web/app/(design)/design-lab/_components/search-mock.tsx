'use client'

import {
  CalendarRange,
  Check,
  ChefHat,
  ChevronDown,
  Clock,
  Search,
  ShoppingCart,
  Users,
} from 'lucide-react'
import { CozyShell } from './cozy-shell'
import { MockImage } from './mock-image'
import { resolveRecipeIcon } from './recipe-icon'
import { MOCK_RECIPES } from './mock-data'
import { useLabNav } from './lab-nav'

// Global search as an Airbnb-style query builder: one bar split into segments
// (which module + per-module filters + keyword), and clicking a segment opens a
// dropdown. Shown here in its OPEN state — the "Module" picker is expanded — to
// demonstrate cross-module search. New functionality; mock only.
const MODULES = [
  { key: 'recipes', label: 'Recipes', icon: ChefHat },
  { key: 'menu', label: 'Weekly menu', icon: CalendarRange },
  { key: 'grocery', label: 'Grocery', icon: ShoppingCart },
  { key: 'members', label: 'Members', icon: Users },
] as const

// Per-module filters shown as dropdown pills below the bar (Recipes selected).
const RECIPE_FILTERS = [
  { label: 'Meal', value: 'Dinner' },
  { label: 'Cuisine', value: 'Any' },
  { label: 'Difficulty', value: 'Easy' },
  { label: 'Dietary', value: 'Vegetarian' },
]

const Segment = ({
  label,
  children,
  active,
  grow = 1,
}: {
  label: string
  children: React.ReactNode
  active?: boolean
  grow?: number
}) => (
  <button
    type="button"
    style={{ flexGrow: grow }}
    className={
      active
        ? 'flex min-w-0 basis-0 flex-col items-start rounded-full bg-background px-4 py-2 text-left cozy-shadow-sm'
        : 'flex min-w-0 basis-0 flex-col items-start rounded-full px-4 py-2 text-left hover:bg-muted/60'
    }
  >
    <span className="text-[11px] font-medium text-muted-foreground">{label}</span>
    <span className="flex w-full items-center gap-1 truncate text-sm font-semibold">{children}</span>
  </button>
)

export const SearchMock = () => {
  const navigate = useLabNav()
  const results = MOCK_RECIPES.filter((r) => r.meal === 'Dinner').slice(0, 3)

  return (
    <CozyShell active="search" title="Search">
      <div className="mx-auto flex max-w-3xl flex-col gap-5">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">Search everything</h2>
          <p className="text-sm text-muted-foreground">
            Build a query across recipes, menus, grocery and members.
          </p>
        </div>

        {/* Segmented search bar + open module dropdown */}
        <div className="relative">
          <div className="flex items-center gap-1 rounded-full border border-border bg-card p-1.5 cozy-shadow-md">
            <Segment label="Module" active>
              <ChefHat className="size-4 shrink-0 text-accent-strong" /> Recipes
              <ChevronDown className="ml-auto size-3.5 shrink-0 text-muted-foreground" />
            </Segment>
            <span className="h-8 w-px shrink-0 bg-border" />
            <Segment label="Meal">
              <span className="font-medium text-muted-foreground">Dinner</span>
              <ChevronDown className="ml-auto size-3.5 shrink-0 text-muted-foreground" />
            </Segment>
            <span className="h-8 w-px shrink-0 bg-border" />
            <Segment label="Keyword" grow={1.4}>
              <span className="font-normal text-muted-foreground">e.g. chipotle…</span>
            </Segment>
            <button
              type="button"
              className="ml-1 inline-flex shrink-0 items-center gap-2 rounded-full bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground cozy-shadow-sm"
            >
              <Search className="size-4" /> Search
            </button>
          </div>

          {/* Open dropdown for the Module segment */}
          <div className="absolute left-0 top-[calc(100%+8px)] z-10 w-64 rounded-2xl border border-border bg-popover p-2 cozy-shadow-lg">
            <p className="px-2 py-1 text-xs font-medium text-muted-foreground">Search in</p>
            {MODULES.map((m, i) => {
              const Icon = m.icon
              const isActive = i === 0
              return (
                <span
                  key={m.key}
                  className={
                    isActive
                      ? 'flex items-center gap-2.5 rounded-xl bg-accent-tint px-2.5 py-2 text-sm font-medium text-accent-strong'
                      : 'flex items-center gap-2.5 rounded-xl px-2.5 py-2 text-sm text-muted-foreground'
                  }
                >
                  <Icon className="size-4" />
                  {m.label}
                  {isActive ? <Check className="ml-auto size-4" /> : null}
                </span>
              )
            })}
          </div>
        </div>

        {/* Per-module filter pills + results (pushed below the open dropdown) */}
        <div className="mt-32 flex flex-wrap gap-2">
          {RECIPE_FILTERS.map((f) => (
            <span
              key={f.label}
              className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-3 py-1.5 text-sm"
            >
              <span className="text-muted-foreground">{f.label}:</span>
              <span className="font-medium">{f.value}</span>
              <ChevronDown className="size-3.5 text-muted-foreground" />
            </span>
          ))}
        </div>

        <div className="flex flex-col gap-2">
          <p className="text-sm text-muted-foreground">{results.length} recipes match</p>
          {results.map((r) => (
            <button
              key={r.id}
              onClick={() => navigate('recipe')}
              className="cozy-card flex items-center gap-3 bg-card p-3 text-left"
            >
              <MockImage
                src={r.image}
                alt={r.name}
                emoji={resolveRecipeIcon(r)}
                className="size-12 shrink-0 rounded-2xl"
                emojiClassName="text-2xl"
              />
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{r.name}</p>
                <p className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span>{r.cuisine}</span>·
                  <span className="inline-flex items-center gap-1">
                    <Clock className="size-3" /> {r.minutes}m
                  </span>
                </p>
              </div>
            </button>
          ))}
        </div>
      </div>
    </CozyShell>
  )
}
