'use client'

import { Check, Clock, Monitor, Moon, Sun } from 'lucide-react'
import { CozyShell } from './cozy-shell'
import { MOCK_MEAL_SCHEDULE } from './mock-data'

// Swatches track the live accent set; strawberry uses the new brand hue (351).
const ACCENTS = [
  { key: 'strawberry', swatch: 'hsl(351 79% 56%)' },
  { key: 'moss', swatch: 'hsl(114 38% 45%)' },
  { key: 'teal', swatch: 'hsl(159 35% 40%)' },
  { key: 'amber', swatch: 'hsl(38 80% 44%)' },
  { key: 'ocean', swatch: 'hsl(205 75% 43%)' },
  { key: 'plum', swatch: 'hsl(285 45% 48%)' },
]

const THEMES = [
  { label: 'Light', icon: Sun },
  { label: 'Dark', icon: Moon },
  { label: 'System', icon: Monitor },
]

const FIELD =
  'w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm cozy-shadow-sm'
const LABEL = 'text-sm font-medium'

// Profile / settings in the cozy style. Mirrors the live Settings surface:
// account (name, read-only email, change password), appearance (accent + theme),
// dietary restrictions + allergies (distinct), and the shared meal schedule (#13).
export const ProfileMock = () => {
  return (
    <CozyShell active="dashboard" title="Profile & settings">
      <div className="mx-auto flex max-w-2xl flex-col gap-5">
        {/* Identity header */}
        <div className="cozy-card flex items-center gap-4 bg-gradient-hero p-5">
          <div className="flex size-16 items-center justify-center rounded-full bg-gradient-to-br from-primary to-secondary text-2xl text-white">
            J
          </div>
          <div>
            <h2 className="text-xl font-semibold tracking-tight">Jorge Zapata</h2>
            <p className="text-sm text-muted-foreground">jzapa@softserveinc.com</p>
          </div>
        </div>

        {/* Account */}
        <div className="cozy-card flex flex-col gap-4 bg-card p-5">
          <h3 className="font-semibold">Account</h3>
          <div className="flex flex-col gap-1.5">
            <label className={LABEL}>Display name</label>
            <input className={FIELD} defaultValue="Jorge Zapata" />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className={LABEL}>Email</label>
            <input
              className={`${FIELD} cursor-not-allowed bg-muted/60 text-muted-foreground`}
              defaultValue="jzapa@softserveinc.com"
              readOnly
            />
            <span className="text-xs text-muted-foreground">Email is managed by your login.</span>
          </div>
        </div>

        {/* Change password (#13: present in the live settings, missing before) */}
        <div className="cozy-card flex flex-col gap-4 bg-card p-5">
          <h3 className="font-semibold">Change password</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <label className={LABEL}>New password</label>
              <input className={FIELD} type="password" defaultValue="········" />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className={LABEL}>Confirm password</label>
              <input className={FIELD} type="password" defaultValue="········" />
            </div>
          </div>
          <button className="w-fit rounded-full border border-border bg-background px-4 py-2 text-sm font-medium">
            Update password
          </button>
        </div>

        {/* Appearance */}
        <div className="cozy-card flex flex-col gap-5 bg-card p-5">
          <h3 className="font-semibold">Appearance</h3>

          <div className="flex flex-col gap-2.5">
            <span className={LABEL}>Accent color</span>
            <div className="flex flex-wrap gap-3">
              {ACCENTS.map((a, i) => (
                <span
                  key={a.key}
                  className="flex size-11 items-center justify-center rounded-full ring-offset-2 ring-offset-background"
                  style={{
                    backgroundColor: a.swatch,
                    boxShadow: i === 0 ? '0 0 0 2px hsl(var(--ring))' : undefined,
                  }}
                >
                  {i === 0 ? <Check className="size-5 text-white" /> : null}
                </span>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-2.5">
            <span className={LABEL}>Theme</span>
            <div className="flex gap-2">
              {THEMES.map((t, i) => {
                const Icon = t.icon
                return (
                  <span
                    key={t.label}
                    className={
                      i === 0
                        ? 'inline-flex items-center gap-2 rounded-full bg-accent-tint px-4 py-2 text-sm font-medium text-accent-strong'
                        : 'inline-flex items-center gap-2 rounded-full border border-border px-4 py-2 text-sm text-muted-foreground'
                    }
                  >
                    <Icon className="size-4" />
                    {t.label}
                  </span>
                )
              })}
            </div>
          </div>
        </div>

        {/* Dietary — restrictions + allergies are distinct (#13) */}
        <div className="cozy-card flex flex-col gap-4 bg-card p-5">
          <h3 className="font-semibold">Dietary preferences</h3>
          <div className="flex flex-col gap-2">
            <span className={LABEL}>Restrictions</span>
            <div className="flex flex-wrap gap-2">
              {['Vegetarian', 'Low dairy'].map((t) => (
                <span
                  key={t}
                  className="rounded-full bg-muted px-3 py-1 text-sm text-muted-foreground"
                >
                  {t}
                </span>
              ))}
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <span className={LABEL}>Allergies</span>
            <div className="flex flex-wrap gap-2">
              {['Peanuts'].map((t) => (
                <span
                  key={t}
                  className="rounded-full bg-warning-tint px-3 py-1 text-sm font-medium text-warning"
                >
                  {t}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Meal schedule — shared workspace default (#13) */}
        <div className="cozy-card flex flex-col gap-3 bg-card p-5">
          <div className="flex items-center gap-2">
            <Clock className="size-4 text-muted-foreground" />
            <h3 className="font-semibold">Meal schedule</h3>
          </div>
          <p className="text-sm text-muted-foreground">
            The default meals everyone eats — members can override their own.
          </p>
          <div className="flex flex-col gap-2">
            {MOCK_MEAL_SCHEDULE.map((slot) => (
              <div key={slot.title} className="grid grid-cols-[1fr_auto_auto] items-center gap-2">
                <input className={FIELD} defaultValue={slot.title} />
                <span className="rounded-full bg-accent-tint px-3 py-1.5 text-xs font-medium text-accent-strong">
                  {slot.mealType}
                </span>
                <input
                  className="w-24 rounded-xl border border-border bg-background px-3 py-2.5 text-sm cozy-shadow-sm"
                  type="time"
                  defaultValue={slot.hour}
                />
              </div>
            ))}
          </div>
        </div>
      </div>
    </CozyShell>
  )
}
