'use client'

import { Fragment, useState } from 'react'
import { Check, ChevronDown, Sparkles, Users, Wand2, Pencil } from 'lucide-react'
import { CozyShell } from './cozy-shell'
import { MEALS, MOCK_MEMBERS, MOCK_WEEK, memberAccentStyle, memberDotStyle } from './mock-data'
import { resolveRecipeIcon } from './recipe-icon'
import { useLabNav } from './lab-nav'

type Mode = 'auto' | 'manual'

// Generate-menu wizard. The live system offers BOTH paths, so the mock does too
// (#9): an "Auto-generate" tab (deterministic engine) and a "Build manually" tab
// (hand-pick a recipe into each day × meal slot). One clear primary action each.
export const MenuCreateMock = () => {
  const navigate = useLabNav()
  const [mode, setMode] = useState<Mode>('auto')
  // Participants: who's eating, tinted with each member's own accent when on.
  const [participants, setParticipants] = useState<Set<string>>(
    () => new Set(['m1', 'm2']),
  )

  return (
    <CozyShell active="menu" title="Generate menu">
      <div className="mx-auto flex max-w-2xl flex-col gap-5">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">Plan your week</h2>
          <p className="text-sm text-muted-foreground">
            Let the engine build it, or hand-pick every slot yourself.
          </p>
        </div>

        {/* Mode tabs (#9) */}
        <div className="flex gap-1 rounded-full bg-muted p-1">
          {(
            [
              { key: 'auto', label: 'Auto-generate', icon: Wand2 },
              { key: 'manual', label: 'Build manually', icon: Pencil },
            ] as const
          ).map((t) => {
            const Icon = t.icon
            const on = mode === t.key
            return (
              <button
                key={t.key}
                type="button"
                onClick={() => setMode(t.key)}
                className={
                  on
                    ? 'flex flex-1 items-center justify-center gap-2 rounded-full bg-background px-3 py-2 text-sm font-medium cozy-shadow-sm'
                    : 'flex flex-1 items-center justify-center gap-2 rounded-full px-3 py-2 text-sm text-muted-foreground'
                }
              >
                <Icon className="size-4" />
                {t.label}
              </button>
            )
          })}
        </div>

        {/* Participants — shared by both modes */}
        <div className="cozy-card flex flex-col gap-3 bg-card p-5">
          <div className="flex items-center gap-2">
            <Users className="size-4 text-muted-foreground" />
            <h3 className="font-semibold">Who&apos;s eating</h3>
          </div>
          <div className="flex flex-wrap gap-2">
            {MOCK_MEMBERS.map((m) => {
              const on = participants.has(m.id)
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() =>
                    setParticipants((s) => {
                      const next = new Set(s)
                      if (next.has(m.id)) next.delete(m.id)
                      else next.add(m.id)
                      return next
                    })
                  }
                  style={on ? memberAccentStyle(m.accent) : undefined}
                  className={
                    on
                      ? 'inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-medium'
                      : 'inline-flex items-center gap-2 rounded-full border border-border px-3 py-1.5 text-sm text-muted-foreground'
                  }
                >
                  {!on ? (
                    <span className="size-2 rounded-full" style={memberDotStyle(m.accent)} />
                  ) : null}
                  {m.name.split(' ')[0]}
                  {on ? <Check className="size-3.5" /> : null}
                </button>
              )
            })}
          </div>
        </div>

        {mode === 'auto' ? (
          <>
            {/* Duration segmented */}
            <div className="cozy-card flex flex-col gap-3 bg-card p-5">
              <h3 className="font-semibold">How many days</h3>
              <div className="flex gap-1 rounded-full bg-muted p-1">
                {['3 days', '5 days', '7 days'].map((d, i) => (
                  <span
                    key={d}
                    className={
                      i === 2
                        ? 'flex-1 rounded-full bg-background px-3 py-1.5 text-center text-sm font-medium cozy-shadow-sm'
                        : 'flex-1 rounded-full px-3 py-1.5 text-center text-sm text-muted-foreground'
                    }
                  >
                    {d}
                  </span>
                ))}
              </div>
            </div>

            {/* This-menu-only overlay */}
            <div className="cozy-card flex flex-col gap-3 bg-card p-5">
              <h3 className="font-semibold">Just for this menu (optional)</h3>
              <p className="text-sm text-muted-foreground">
                Extra restrictions layered on top of profiles — won&apos;t change anyone&apos;s
                saved preferences.
              </p>
              <div className="flex flex-wrap gap-2">
                {['No pork', 'Lighter dinners'].map((t) => (
                  <span
                    key={t}
                    className="rounded-full bg-muted px-3 py-1 text-sm text-muted-foreground"
                  >
                    {t}
                  </span>
                ))}
              </div>
            </div>

            <button
              onClick={() => navigate('menu')}
              className="inline-flex items-center justify-center gap-2 rounded-full bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground cozy-shadow-lg"
            >
              <Sparkles className="size-4" /> Generate draft
            </button>
          </>
        ) : (
          <>
            {/* Manual builder — pick a recipe into each day × meal slot */}
            <div className="cozy-card flex flex-col gap-3 bg-card p-4">
              <h3 className="font-semibold">Build each slot</h3>
              <div className="overflow-x-auto">
                <div className="grid min-w-[560px] grid-cols-[3rem_repeat(3,1fr)] gap-2">
                  <span />
                  {MEALS.map((meal) => (
                    <span
                      key={meal}
                      className="px-1 pb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground"
                    >
                      {meal}
                    </span>
                  ))}
                  {MOCK_WEEK.slice(0, 3).map(({ day, meals }) => (
                    <Fragment key={day}>
                      <span className="flex items-center text-sm font-semibold text-muted-foreground">
                        {day}
                      </span>
                      {MEALS.map((meal) => {
                        const recipe = meals[meal]
                        return (
                          <button
                            key={meal}
                            type="button"
                            className="flex min-h-[3rem] items-center gap-1.5 rounded-xl border border-border bg-background px-2 py-1.5 text-left text-xs"
                          >
                            {recipe ? (
                              <>
                                <span className="text-base">{resolveRecipeIcon(recipe)}</span>
                                <span className="line-clamp-2 font-medium leading-tight">
                                  {recipe.name}
                                </span>
                              </>
                            ) : (
                              <span className="flex w-full items-center justify-between text-muted-foreground">
                                Pick recipe
                                <ChevronDown className="size-3.5" />
                              </span>
                            )}
                          </button>
                        )
                      })}
                    </Fragment>
                  ))}
                </div>
              </div>
            </div>

            <button
              onClick={() => navigate('menu')}
              className="inline-flex items-center justify-center gap-2 rounded-full bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground cozy-shadow-lg"
            >
              <Check className="size-4" /> Save menu
            </button>
          </>
        )}
      </div>
    </CozyShell>
  )
}
