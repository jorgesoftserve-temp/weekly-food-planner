// Shared cozy auth styling tokens (v1.9). Promoted from the design-lab
// auth-mock: rounded-xl fields, pill CTAs, accent-strong links, and the
// success/warning token notes (replacing the old hardcoded emerald/amber).
// Plain string consts so the existing client forms keep their logic untouched
// and only swap classNames.

export const authInputClass =
  'h-11 rounded-xl border border-input bg-background px-3.5 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'

export const authPrimaryButtonClass =
  'inline-flex h-11 items-center justify-center rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground shadow-sm transition hover:bg-primary/90 disabled:opacity-60'

export const authSecondaryButtonClass =
  'inline-flex h-11 items-center justify-center gap-2 rounded-full border border-border bg-background px-5 text-sm font-medium transition hover:bg-muted disabled:opacity-60'

export const authLinkClass =
  'font-medium text-accent-strong underline-offset-4 hover:underline'

// Inline status notes — cozy tinted callouts using semantic tokens.
export const authSuccessNoteClass =
  'rounded-xl border border-success/30 bg-success-tint px-3 py-2 text-sm text-success'

export const authWarningNoteClass =
  'flex flex-col gap-2 rounded-xl border border-warning/30 bg-warning-tint px-3 py-2 text-sm text-warning'
