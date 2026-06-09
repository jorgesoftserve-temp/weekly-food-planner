'use client'

import { useState } from 'react'
import { CalendarRange, CheckCircle2, Plus, ShoppingCart, Sparkles } from 'lucide-react'
import { CozyShell } from './cozy-shell'
import { MockImage } from './mock-image'
import { resolveRecipeIcon } from './recipe-icon'
import { MOCK_DAYS, MOCK_MEMBERS, memberAccentStyle, memberDotStyle } from './mock-data'
import { useLabNav } from './lab-nav'

// Bento-style overview: a warm hero, a member selector (whose menu am I viewing),
// then differently-sized rounded cards. Clicking through navigates like a
// prototype.
export const DashboardMock = () => {
  const navigate = useLabNav()
  // null = "Everyone" (shared view); otherwise a specific member's plan.
  const [selected, setSelected] = useState<string | null>(null)
  const active = MOCK_MEMBERS.find((m) => m.id === selected) ?? null
  const who = active ? active.name.split(' ')[0] : 'everyone'

  return (
    <CozyShell active="dashboard" title="Dashboard">
      <div className="mx-auto flex max-w-5xl flex-col gap-5">
        {/* Hero */}
        <div className="cozy-card bg-gradient-hero p-6">
          <p className="text-sm text-muted-foreground">Good evening, Jorge 👋</p>
          <h2 className="mt-1 text-2xl font-semibold tracking-tight">
            This week is 5 of 7 meals planned
          </h2>
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              onClick={() => navigate('menu-create')}
              className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground cozy-shadow-sm"
            >
              <Sparkles className="size-4" /> Generate the rest
            </button>
            <button
              onClick={() => navigate('recipe-create')}
              className="inline-flex items-center gap-2 rounded-full border border-border bg-background px-4 py-2 text-sm font-medium"
            >
              <Plus className="size-4" /> Add a recipe
            </button>
          </div>
        </div>

        {/* Member selector — whose menu am I looking at (#4 / #14: accent on switch) */}
        <div className="flex flex-col gap-2">
          <span className="text-sm font-medium text-muted-foreground">Viewing menu for</span>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setSelected(null)}
              className={
                selected === null
                  ? 'inline-flex items-center gap-2 rounded-full bg-accent-tint px-3 py-1.5 text-sm font-medium text-accent-strong'
                  : 'inline-flex items-center gap-2 rounded-full border border-border px-3 py-1.5 text-sm text-muted-foreground'
              }
            >
              Everyone
            </button>
            {MOCK_MEMBERS.map((m) => {
              const isOn = m.id === selected
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setSelected(m.id)}
                  style={isOn ? memberAccentStyle(m.accent) : undefined}
                  className={
                    isOn
                      ? 'inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-medium'
                      : 'inline-flex items-center gap-2 rounded-full border border-border px-3 py-1.5 text-sm text-muted-foreground'
                  }
                >
                  {!isOn ? (
                    <span className="size-2 rounded-full" style={memberDotStyle(m.accent)} />
                  ) : null}
                  {m.name.split(' ')[0]}
                </button>
              )
            })}
          </div>
        </div>

        {/* Bento grid */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <button
            onClick={() => navigate('menu')}
            className="cozy-card cozy-lift flex flex-col items-start gap-2 bg-card p-5 text-left"
          >
            <div className="flex size-10 items-center justify-center rounded-2xl bg-accent-tint text-accent-strong">
              <CalendarRange className="size-5" />
            </div>
            <span className="text-2xl font-semibold">7</span>
            <span className="text-sm text-muted-foreground">Days this menu</span>
          </button>
          {/* #12: actionable "cooked today" instead of pool size */}
          <button
            onClick={() => navigate('menu')}
            className="cozy-card cozy-lift flex flex-col items-start gap-2 bg-card p-5 text-left"
          >
            <div className="flex size-10 items-center justify-center rounded-2xl bg-success-tint text-success">
              <CheckCircle2 className="size-5" />
            </div>
            <span className="text-2xl font-semibold">
              2 <span className="text-base font-medium text-muted-foreground">/ 3</span>
            </span>
            <span className="text-sm text-muted-foreground">Meals cooked today</span>
          </button>
          <button
            onClick={() => navigate('grocery')}
            className="cozy-card cozy-lift flex flex-col items-start gap-2 bg-card p-5 text-left"
          >
            <div className="flex size-10 items-center justify-center rounded-2xl bg-accent-tint text-accent-strong">
              <ShoppingCart className="size-5" />
            </div>
            <span className="text-2xl font-semibold">12</span>
            <span className="text-sm text-muted-foreground">Items to buy</span>
          </button>

          {/* Wide card: this week preview (reflects the selected member) */}
          <div className="cozy-card bg-card p-5 sm:col-span-2 lg:col-span-3">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="font-semibold capitalize">{who}&apos;s week</h3>
              <button
                onClick={() => navigate('menu')}
                className="text-sm text-accent-strong"
              >
                View menu →
              </button>
            </div>
            <div className="flex gap-3 overflow-x-auto pb-1">
              {MOCK_DAYS.map(({ day, recipe }) => (
                <button
                  key={day}
                  onClick={() => navigate('recipe')}
                  className="flex w-28 shrink-0 flex-col gap-2 rounded-2xl border border-border bg-background p-3 text-left"
                >
                  <span className="text-xs font-medium text-muted-foreground">{day}</span>
                  <MockImage
                    src={recipe.image}
                    alt={recipe.name}
                    emoji={resolveRecipeIcon(recipe)}
                    className="aspect-square w-full rounded-xl"
                    emojiClassName="text-3xl"
                  />
                  <span className="line-clamp-2 text-xs font-medium leading-tight">
                    {recipe.name}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </CozyShell>
  )
}
