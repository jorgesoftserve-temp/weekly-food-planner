'use client'

import { MoreHorizontal, Pencil, Trash2 } from 'lucide-react'
import type { MemberRecord } from '@weekly-food-planner/supabase'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'
import { deriveAccentFromId } from './derive-accent'

// ── Helpers ──────────────────────────────────────────────────────────────────

const ROLE_LABEL: Record<string, string> = {
  creator: 'Creator',
  admin: 'Admin',
  member: 'Member',
}

const initials = (name: string): string =>
  name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('')

// ── Types ─────────────────────────────────────────────────────────────────────

export type MemberCardProps = {
  member: MemberRecord
  canManage: boolean
  onEdit: ({ memberId }: { memberId: string }) => void
  onDelete: ({ member }: { member: MemberRecord }) => void
}

// ── Component ─────────────────────────────────────────────────────────────────
//
// Per-member accent is sourced from member.accent_color; when NULL a stable
// accent is derived from the member id via deriveAccentFromId (hash → one of
// the six keys, no randomness). The accent key is set as data-accent on the
// card element so the plain-attribute [data-accent="…"] selectors in
// globals.css set --user-accent/--user-accent-strong/--user-accent-tint for
// this card's subtree. Ring, dot, and role-badge tint then use the helper
// classes bg-accent-tint / text-accent-strong / ring-user-accent — never
// inline hex.
//
// Accent surfaces only on member-tied elements (avatar ring, name dot, role
// badge). The DropdownMenu trigger and Remove item use brand/destructive
// semantics and are intentionally accent-free.

export const MemberCard = ({ member, canManage, onEdit, onDelete }: MemberCardProps) => {
  const accentKey = member.accent_color ?? deriveAccentFromId(member.id)
  const isCreator = member.role === 'creator'
  const label = ROLE_LABEL[member.role] ?? member.role
  const memberInitials = initials(member.name)

  return (
    // data-accent scopes the --user-accent* token family to this card subtree.
    <Card
      data-accent={accentKey}
      className="relative hover-lift flex cursor-pointer flex-col items-center gap-3 p-5 text-center"
      onClick={() => onEdit({ memberId: member.id })}
      // Keyboard activation via Enter/Space (handled natively for div via role)
      role="button"
      tabIndex={0}
      aria-label={`Edit ${member.name}`}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onEdit({ memberId: member.id })
        }
      }}
    >
      {/* Actions menu — stop propagation so card click doesn't fire */}
      <div
        className="absolute top-2 right-2"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
      >
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              aria-label={`Actions for ${member.name}`}
              className="size-7"
            >
              <MoreHorizontal className="size-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              onSelect={(event) => {
                event.preventDefault()
                onEdit({ memberId: member.id })
              }}
            >
              <Pencil className="mr-2 size-4" />
              Edit
            </DropdownMenuItem>
            {canManage && !isCreator ? (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="text-destructive focus:bg-destructive/10 focus:text-destructive"
                  onSelect={(event) => {
                    event.preventDefault()
                    onDelete({ member })
                  }}
                >
                  <Trash2 className="mr-2 size-4" />
                  Remove
                </DropdownMenuItem>
              </>
            ) : null}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Avatar with accent ring */}
      <div
        className={cn(
          'rounded-full p-0.5',
          'ring-2 ring-user-accent ring-offset-1 ring-offset-card',
        )}
      >
        <div
          className={cn(
            'flex size-16 items-center justify-center rounded-full',
            'bg-accent-tint text-accent-strong',
            'text-lg font-semibold',
          )}
          aria-hidden="true"
        >
          {memberInitials}
        </div>
      </div>

      {/* Name + role */}
      <div className="flex flex-col gap-1">
        <h3 className="flex items-center justify-center gap-1.5 font-semibold leading-tight">
          {/* Accent dot — member-tied surface */}
          <span
            className="size-2 shrink-0 rounded-full bg-user-accent"
            aria-hidden="true"
          />
          {member.name}
        </h3>
        {/* Role badge — accent-tinted, member-tied */}
        <span className="mx-auto rounded-pill bg-accent-tint px-2.5 py-0.5 text-xs font-medium text-accent-strong">
          {label}
        </span>
        <span className="text-xs capitalize text-muted-foreground">
          {member.age_category.replace(/_/g, ' ')}
        </span>
      </div>

      {/* Dietary restrictions + allergy chips */}
      {(member.member_dietary_restrictions.length > 0 ||
        member.member_allergies.length > 0) ? (
        <div className="flex flex-wrap justify-center gap-1.5">
          {member.member_dietary_restrictions.map(({ restriction }) => (
            <span
              key={restriction}
              className="rounded-pill bg-muted px-2.5 py-1 text-xs text-muted-foreground"
            >
              {restriction}
            </span>
          ))}
          {member.member_allergies.map(({ allergy }) => (
            <span
              key={allergy}
              className="rounded-pill bg-warning-tint px-2.5 py-1 text-xs font-medium text-warning"
            >
              {allergy} allergy
            </span>
          ))}
        </div>
      ) : null}
    </Card>
  )
}
