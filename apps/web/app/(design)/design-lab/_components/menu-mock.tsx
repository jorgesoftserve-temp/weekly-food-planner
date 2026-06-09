'use client'

import { Fragment, useState } from 'react'
import { Check, Clock, Plus, RefreshCw } from 'lucide-react'
import { CozyShell } from './cozy-shell'
import { MockImage } from './mock-image'
import { resolveRecipeIcon } from './recipe-icon'
import { MEALS, MOCK_MEMBERS, MOCK_WEEK, memberAccentStyle, memberDotStyle } from './mock-data'
import { useLabNav } from './lab-nav'

// Weekly menu as a day-row × meal-column grid — every meal of every day is
// visible at once (the live menu is day × meal_key slots, not one dish per day).
// A member selector switches whose plan you're viewing, tinted with that
// member's accent (#8 / #14). Clicking a slot opens Cook mode.
export const MenuMock = () => {
  const navigate = useLabNav()
  const [selected, setSelected] = useState<string | null>(null)
  const active = MOCK_MEMBERS.find((m) => m.id === selected) ?? null
  const who = active ? `${active.name.split(' ')[0]}’s` : 'Everyone’s'

  return (
    <CozyShell active="menu" title="Weekly menu">
      <div className="mx-auto flex max-w-5xl flex-col gap-4">
        {/* Draft band */}
        <div className="cozy-card flex flex-col gap-3 bg-gradient-hero p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-2">
            <Clock className="mt-0.5 size-4 text-warning" />
            <div>
              <div className="flex items-center gap-2">
                <p className="text-sm font-medium">Reviewing draft</p>
                <span className="rounded-full bg-warning-tint px-2 py-0.5 text-xs font-medium text-warning">
                  Draft
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                Accept to drive the grocery list, or regenerate.
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => navigate('menu-create')}
              className="inline-flex items-center gap-2 rounded-full border border-border bg-background px-4 py-2 text-sm font-medium"
            >
              <RefreshCw className="size-4" /> Regenerate
            </button>
            <button
              onClick={() => navigate('grocery')}
              className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground cozy-shadow-sm"
            >
              <Check className="size-4" /> Accept menu
            </button>
          </div>
        </div>

        {/* Member selector (#8 / #14) */}
        <div className="flex flex-col gap-2">
          <span className="text-sm font-medium text-muted-foreground">Showing {who} meals</span>
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

        {/* Day × meal grid */}
        <div className="cozy-card overflow-x-auto bg-card p-4">
          <div className="grid min-w-[680px] grid-cols-[3.5rem_repeat(3,1fr)] gap-2">
            {/* Header row */}
            <span />
            {MEALS.map((meal) => (
              <span
                key={meal}
                className="px-2 pb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground"
              >
                {meal}
              </span>
            ))}

            {/* Day rows */}
            {MOCK_WEEK.map(({ day, meals }) => (
              <Fragment key={day}>
                <span className="flex items-center text-sm font-semibold text-muted-foreground">
                  {day}
                </span>
                {MEALS.map((meal) => {
                  const recipe = meals[meal]
                  if (!recipe) {
                    return (
                      <button
                        key={meal}
                        onClick={() => navigate('menu-create')}
                        className="flex min-h-[3.25rem] items-center justify-center gap-1 rounded-xl border border-dashed border-border text-xs text-muted-foreground"
                      >
                        <Plus className="size-3.5" /> Add
                      </button>
                    )
                  }
                  return (
                    <button
                      key={meal}
                      onClick={() => navigate('recipe-cook')}
                      className="flex min-h-[3.25rem] items-center gap-2 rounded-xl border border-border bg-background p-2 text-left transition hover:bg-muted/60"
                    >
                      <MockImage
                        src={recipe.image}
                        alt={recipe.name}
                        emoji={resolveRecipeIcon(recipe)}
                        className="size-9 shrink-0 rounded-lg"
                        emojiClassName="text-lg"
                      />
                      <span className="line-clamp-2 text-xs font-medium leading-tight">
                        {recipe.name}
                      </span>
                    </button>
                  )
                })}
              </Fragment>
            ))}
          </div>
        </div>
      </div>
    </CozyShell>
  )
}
