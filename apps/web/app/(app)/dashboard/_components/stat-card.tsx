'use client'

import Link from 'next/link'
import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

type StatCardVariant = 'accent' | 'success'

type StatCardProps = {
  icon: LucideIcon
  value: number | string
  label: string
  href: string
  variant?: StatCardVariant
}

const ICON_CLASSES: Record<StatCardVariant, string> = {
  accent: 'bg-accent-tint text-accent-strong',
  success: 'bg-success-tint text-success',
}

// Interactive stat card that lifts on hover. Uses .hover-lift for
// the cozy micro-interaction (reduced-motion safe via globals.css).
export const StatCard = ({
  icon: Icon,
  value,
  label,
  href,
  variant = 'accent',
}: StatCardProps) => (
  <Link
    href={href}
    className={cn(
      'hover-lift flex flex-col items-start gap-2 rounded-2xl border border-border bg-card p-5 shadow-md',
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
    )}
  >
    <div
      className={cn(
        'flex size-10 items-center justify-center rounded-2xl',
        ICON_CLASSES[variant],
      )}
    >
      <Icon className="size-5" aria-hidden="true" />
    </div>
    <span className="text-2xl font-semibold">{value}</span>
    <span className="text-sm text-muted-foreground">{label}</span>
  </Link>
)
