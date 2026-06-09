'use client'

import { useTheme } from 'next-themes'
import { Check, Monitor, Moon, Sun } from 'lucide-react'
import type { AccentColor } from '@weekly-food-planner/supabase'
import { useUpdateAccentColor } from '@weekly-food-planner/supabase/react'
import { useSupabase } from '@/lib/hooks/use-supabase'
import { useAuthUser } from '@/lib/hooks/use-auth-user'
import { useAccent } from '@/components/app-shell/accent-provider'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import { notifyError } from '@/lib/toast'

// The six curated accents. Swatch shows the light-mode solid; the live preview
// comes from the actual --user-accent token once selected. See
// docs/design/user-accent-colors.md.
const ACCENTS: Array<{ value: AccentColor; label: string; swatch: string }> = [
  { value: 'strawberry', label: 'Strawberry', swatch: 'hsl(359 79% 56%)' },
  { value: 'moss', label: 'Moss', swatch: 'hsl(114 38% 45%)' },
  { value: 'teal', label: 'Teal', swatch: 'hsl(159 35% 40%)' },
  { value: 'amber', label: 'Amber', swatch: 'hsl(38 80% 44%)' },
  { value: 'ocean', label: 'Ocean', swatch: 'hsl(205 75% 43%)' },
  { value: 'plum', label: 'Plum', swatch: 'hsl(285 45% 48%)' },
]

const THEMES = [
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: Moon },
  { value: 'system', label: 'System', icon: Monitor },
] as const

export const AppearanceCard = () => {
  const supabase = useSupabase()
  const { data: user } = useAuthUser()
  const { accent, setAccent } = useAccent()
  const { theme, setTheme } = useTheme()

  const updateAccent = useUpdateAccentColor({
    supabase,
    userId: user?.id ?? '',
  })

  const handleAccentSelect = (next: AccentColor) => {
    if (!user || next === accent) return
    const previous = accent
    // Optimistic preview — the whole shell recolors instantly.
    setAccent(next)
    updateAccent.mutate(
      { accentColor: next },
      {
        onError: () => {
          setAccent(previous)
          notifyError('Could not save accent', 'Your previous accent was restored.')
        },
      },
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Appearance</CardTitle>
        <CardDescription>
          Personalize how the app looks. Your accent follows you across every workspace.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        <fieldset className="flex flex-col gap-3">
          <Label asChild>
            <legend>Accent color</legend>
          </Label>
          <div
            role="radiogroup"
            aria-label="Accent color"
            className="flex flex-wrap gap-3"
          >
            {ACCENTS.map((option) => {
              const selected = option.value === accent
              return (
                <button
                  key={option.value}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  aria-label={option.label}
                  title={option.label}
                  onClick={() => handleAccentSelect(option.value)}
                  className={cn(
                    'flex size-11 items-center justify-center rounded-full ring-offset-2 ring-offset-background transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                    selected && 'ring-2 ring-ring',
                  )}
                  style={{ backgroundColor: option.swatch }}
                >
                  {selected ? (
                    <Check className="size-5 text-white" aria-hidden />
                  ) : null}
                </button>
              )
            })}
          </div>
        </fieldset>

        <fieldset className="flex flex-col gap-3">
          <Label asChild>
            <legend>Theme</legend>
          </Label>
          <div
            role="radiogroup"
            aria-label="Theme"
            className="flex flex-wrap gap-2"
          >
            {THEMES.map((option) => {
              const Icon = option.icon
              const selected = theme === option.value
              return (
                <button
                  key={option.value}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => setTheme(option.value)}
                  className={cn(
                    'flex min-h-11 items-center gap-2 rounded-md border px-4 py-2 text-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                    selected
                      ? 'border-transparent bg-accent-tint text-accent-strong'
                      : 'border-border text-foreground hover:bg-muted',
                  )}
                >
                  <Icon className="size-4" aria-hidden />
                  {option.label}
                </button>
              )
            })}
          </div>
        </fieldset>
      </CardContent>
    </Card>
  )
}
