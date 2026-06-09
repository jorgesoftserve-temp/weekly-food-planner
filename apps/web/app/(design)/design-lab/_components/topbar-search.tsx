'use client'

import { useState } from 'react'
import { ArrowLeft, ChefHat, Search, Users, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { resolveRecipeIcon } from './recipe-icon'
import { MOCK_MEMBERS, MOCK_RECIPES, memberDotStyle } from './mock-data'
import { useLabNav } from './lab-nav'

// Simplified topbar search (cf. Figma's quick search): one keyword field that
// looks across ALL modules and shows grouped results inline. "See all results"
// hands off to the full query-builder screen (search-mock.tsx).
//
// Behavior:
//   • Results appear ONLY once the user types (empty = a short hint, no rows).
//   • Desktop (sm+): an inline pill with a dropdown below.
//   • Mobile (<sm): a search icon that opens a full-width top sheet with a big
//     input — the touch-first pattern, not a shrunken desktop pill.
export const TopbarSearch = () => {
  const navigate = useLabNav()
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)

  const q = query.trim().toLowerCase()
  const hasQuery = q.length > 0
  const recipeHits = hasQuery
    ? MOCK_RECIPES.filter((r) => r.name.toLowerCase().includes(q)).slice(0, 4)
    : []
  const memberHits = hasQuery
    ? MOCK_MEMBERS.filter((m) => m.name.toLowerCase().includes(q)).slice(0, 3)
    : []
  const hasHits = recipeHits.length > 0 || memberHits.length > 0

  const close = () => {
    setOpen(false)
    setMobileOpen(false)
  }
  const goto = (screen: string) => {
    close()
    navigate(screen)
  }

  // Shared results body — used in both the desktop dropdown and the mobile sheet.
  const body = (
    <>
      {!hasQuery ? (
        <p className="px-4 py-6 text-center text-sm text-muted-foreground">
          Start typing to search recipes, people and menus.
        </p>
      ) : hasHits ? (
        <div className="max-h-80 overflow-y-auto p-2">
          {recipeHits.length > 0 ? (
            <>
              <p className="px-2.5 pb-1 pt-2 text-xs font-medium text-muted-foreground">Recipes</p>
              {recipeHits.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => goto('recipe')}
                  className="flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left hover:bg-muted"
                >
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted text-base">
                    {resolveRecipeIcon(r)}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium">{r.name}</span>
                    <span className="block text-xs text-muted-foreground">
                      {r.meal} · {r.cuisine}
                    </span>
                  </span>
                  <ChefHat className="ml-auto size-3.5 shrink-0 text-muted-foreground" />
                </button>
              ))}
            </>
          ) : null}

          {memberHits.length > 0 ? (
            <>
              <p className="px-2.5 pb-1 pt-2 text-xs font-medium text-muted-foreground">People</p>
              {memberHits.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => goto('members')}
                  className="flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left hover:bg-muted"
                >
                  <span className="relative flex size-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary to-secondary text-xs font-semibold text-white">
                    {m.initials}
                    <span
                      className="absolute -bottom-0.5 -right-0.5 size-3 rounded-full border-2 border-popover"
                      style={memberDotStyle(m.accent)}
                    />
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium">{m.name}</span>
                    <span className="block text-xs text-muted-foreground">{m.role}</span>
                  </span>
                  <Users className="ml-auto size-3.5 shrink-0 text-muted-foreground" />
                </button>
              ))}
            </>
          ) : null}
        </div>
      ) : (
        <p className="px-4 py-6 text-center text-sm text-muted-foreground">
          No matches for “{query}”.
        </p>
      )}

      {/* Hand-off to the advanced query-builder screen */}
      <button
        type="button"
        onClick={() => goto('search')}
        className={cn(
          'flex w-full items-center gap-2 border-t border-border px-4 py-2.5 text-sm font-medium text-accent-strong',
          'hover:bg-accent-tint',
        )}
      >
        <Search className="size-4" />
        {hasQuery ? `See all results for “${query}”` : 'Open advanced search'}
      </button>
    </>
  )

  return (
    <>
      {/* Mobile: search icon only (touch-first) */}
      <button
        type="button"
        aria-label="Search"
        onClick={() => setMobileOpen(true)}
        className="flex size-9 shrink-0 items-center justify-center rounded-full border border-border bg-muted/60 text-muted-foreground sm:hidden"
      >
        <Search className="size-4" />
      </button>

      {/* Desktop: inline pill + dropdown */}
      <div className="relative hidden w-full max-w-xs sm:block">
        <div className="flex items-center gap-2 rounded-full border border-border bg-muted/60 px-3 py-1.5">
          <Search className="size-4 shrink-0 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => setOpen(true)}
            onBlur={() => window.setTimeout(() => setOpen(false), 120)}
            placeholder="Search everything…"
            className="w-full min-w-0 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
          {query ? (
            <button
              type="button"
              aria-label="Clear search"
              onClick={() => setQuery('')}
              className="shrink-0 text-muted-foreground"
            >
              <X className="size-4" />
            </button>
          ) : null}
        </div>

        {open ? (
          <div className="absolute right-0 top-[calc(100%+8px)] z-20 w-[20rem] max-w-[calc(100vw-2rem)] overflow-hidden rounded-2xl border border-border bg-popover cozy-shadow-lg">
            {body}
          </div>
        ) : null}
      </div>

      {/* Mobile: full-width top sheet */}
      {mobileOpen ? (
        <div className="fixed inset-0 z-50 flex flex-col bg-background/80 backdrop-blur-sm sm:hidden">
          <div className="flex items-center gap-2 border-b border-border bg-background px-3 py-2.5">
            <button
              type="button"
              aria-label="Close search"
              onClick={close}
              className="flex size-9 shrink-0 items-center justify-center rounded-full text-muted-foreground"
            >
              <ArrowLeft className="size-5" />
            </button>
            <div className="flex flex-1 items-center gap-2 rounded-full border border-border bg-muted/60 px-3 py-2">
              <Search className="size-4 shrink-0 text-muted-foreground" />
              <input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search everything…"
                className="w-full min-w-0 bg-transparent text-base outline-none placeholder:text-muted-foreground"
              />
              {query ? (
                <button type="button" aria-label="Clear search" onClick={() => setQuery('')}>
                  <X className="size-4 text-muted-foreground" />
                </button>
              ) : null}
            </div>
          </div>
          <div className="flex-1 overflow-y-auto bg-background">{body}</div>
        </div>
      ) : null}
    </>
  )
}
