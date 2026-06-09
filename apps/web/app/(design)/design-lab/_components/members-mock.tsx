'use client'

import { Plus } from 'lucide-react'
import { CozyShell } from './cozy-shell'
import { MockImage } from './mock-image'
import { MOCK_MEMBERS, memberAccentStyle, memberDotStyle, memberRingStyle } from './mock-data'
import { useLabNav } from './lab-nav'

// Warm member cards: avatar (photo → initials fallback), role badge, dietary
// chips. Each card carries the member's own accent as a light distinction (#11) —
// a faint ring round the avatar, a dot by the name, and an accent-tinted role
// badge — so members read as distinct without flooding the UI with color.
export const MembersMock = () => {
  const navigate = useLabNav()
  return (
    <CozyShell active="members" title="Members">
      <div className="mx-auto flex max-w-4xl flex-col gap-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-xl font-semibold tracking-tight">Household</h2>
            <p className="text-sm text-muted-foreground">
              Who&apos;s eating and what they can&apos;t.
            </p>
          </div>
          <button className="inline-flex w-fit items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground cozy-shadow-sm">
            <Plus className="size-4" /> Add member
          </button>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {MOCK_MEMBERS.map((m) => (
            <button
              key={m.id}
              onClick={() => navigate('profile')}
              className="cozy-card cozy-lift flex cursor-pointer flex-col items-center gap-3 bg-card p-5 text-center"
            >
              {/* Faint accent ring around the avatar (#11) */}
              <div className="rounded-full p-0.5" style={memberRingStyle(m.accent)}>
                <MockImage
                  src={m.avatar}
                  alt={m.name}
                  emoji={m.initials}
                  className="size-16 rounded-full"
                  emojiClassName="text-lg font-semibold text-foreground"
                />
              </div>
              <div className="flex flex-col gap-1">
                <h3 className="flex items-center justify-center gap-1.5 font-semibold leading-tight">
                  <span className="size-2 rounded-full" style={memberDotStyle(m.accent)} />
                  {m.name}
                </h3>
                {/* Role badge tinted with the member's own accent */}
                <span
                  style={memberAccentStyle(m.accent)}
                  className="mx-auto rounded-full px-2.5 py-0.5 text-xs font-medium"
                >
                  {m.role}
                </span>
                <span className="text-xs text-muted-foreground">{m.ageCategory}</span>
              </div>
              <div className="flex flex-wrap justify-center gap-1.5">
                {m.dietary.map((tag) => (
                  <span
                    key={tag}
                    className="rounded-full bg-muted px-2.5 py-1 text-xs text-muted-foreground"
                  >
                    {tag}
                  </span>
                ))}
                {m.allergies.map((tag) => (
                  <span
                    key={tag}
                    className="rounded-full bg-warning-tint px-2.5 py-1 text-xs font-medium text-warning"
                  >
                    {tag} allergy
                  </span>
                ))}
              </div>
            </button>
          ))}
        </div>
      </div>
    </CozyShell>
  )
}
