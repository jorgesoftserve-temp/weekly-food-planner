'use client'

import Link from 'next/link'
import { Plus, Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'

type HeroCardProps = {
  workspaceName: string | null
  isLoading: boolean
  daysPlanned: number | null
  durationDays: number | null
  hasDraft: boolean
}

export const HeroCard = ({
  workspaceName,
  isLoading,
  daysPlanned,
  durationDays,
  hasDraft,
}: HeroCardProps) => {
  const now = new Date()
  const hour = now.getHours()
  const greeting =
    hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'

  // Day-based, so it can't go nonsensical on multi-member households (slots are
  // per member×day×meal). When the whole span is covered it reads as complete.
  const summaryLine =
    !isLoading && daysPlanned !== null && durationDays !== null && durationDays > 0
      ? daysPlanned >= durationDays
        ? `Your week is planned`
        : `${daysPlanned} of ${durationDays} days planned this week`
      : 'Plan your week'

  return (
    <div
      className={cn(
        'rounded-2xl border border-border bg-card p-6 shadow-md bg-gradient-hero',
      )}
    >
      <p className="text-sm text-muted-foreground">{greeting}</p>
      <h2 className="mt-1 text-2xl font-semibold tracking-tight">
        {isLoading
          ? (workspaceName ?? 'Your workspace')
          : summaryLine}
      </h2>
      {workspaceName && !isLoading ? (
        <p className="mt-0.5 text-sm text-muted-foreground">{workspaceName}</p>
      ) : null}
      <div className="mt-4 flex flex-wrap gap-2">
        <Link
          href="/menu"
          className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm transition-opacity hover:opacity-90"
        >
          <Sparkles className="size-4" />
          {hasDraft ? 'Review draft' : 'Generate menu'}
        </Link>
        <Link
          href="/recipes"
          className="inline-flex items-center gap-2 rounded-full border border-border bg-background px-4 py-2 text-sm font-medium transition-colors hover:bg-muted"
        >
          <Plus className="size-4" />
          Add a recipe
        </Link>
      </div>
    </div>
  )
}
