'use client'

import type { ReactNode } from 'react'
import { ChefHat, Mail, RotateCcw } from 'lucide-react'
import { cn } from '@/lib/utils'

// Cozy auth mocks (login / signup / confirm-email) for v1.9. Presentational
// only — no real Supabase auth here; these are the reviewable target the live
// (auth) pages get promoted to. Centered cozy card on a gradient-hero wash,
// which maps 1:1 onto the future (auth)/layout.tsx + form restyle.

const AuthScaffold = ({ children }: { children: ReactNode }) => (
  <div className="flex min-h-[640px] w-full items-center justify-center rounded-2xl bg-gradient-hero p-6 text-foreground">
    <div className="cozy-card flex w-full max-w-sm flex-col gap-6 bg-card p-7">
      {children}
    </div>
  </div>
)

const BrandMark = ({ title, subtitle }: { title: string; subtitle: string }) => (
  <div className="flex flex-col items-center gap-3 text-center">
    <div className="flex size-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground cozy-shadow-sm">
      <ChefHat className="size-6" />
    </div>
    <div className="flex flex-col gap-1">
      <h2 className="text-xl font-semibold tracking-tight">{title}</h2>
      <p className="text-sm text-muted-foreground">{subtitle}</p>
    </div>
  </div>
)

const Field = ({
  label,
  type = 'text',
  placeholder,
  trailing,
  hint,
}: {
  label: string
  type?: string
  placeholder?: string
  trailing?: ReactNode
  hint?: string
}) => (
  <label className="flex flex-col gap-1.5 text-sm font-medium">
    <span className="flex items-center justify-between">
      {label}
      {trailing}
    </span>
    <input
      type={type}
      placeholder={placeholder}
      className="h-11 rounded-xl border border-border bg-background px-3.5 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    />
    {hint ? <span className="text-xs font-normal text-muted-foreground">{hint}</span> : null}
  </label>
)

const PrimaryButton = ({ children }: { children: ReactNode }) => (
  <button
    type="button"
    className="inline-flex h-11 items-center justify-center rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground cozy-shadow-sm transition hover:bg-primary/90"
  >
    {children}
  </button>
)

const FootLink = ({ lead, label }: { lead: string; label: string }) => (
  <p className="text-center text-sm text-muted-foreground">
    {lead}{' '}
    <span className="font-medium text-accent-strong underline-offset-4 hover:underline">
      {label}
    </span>
  </p>
)

export const LoginMock = () => (
  <AuthScaffold>
    <BrandMark title="Welcome back" subtitle="Sign in to plan your week." />
    <form className="flex flex-col gap-4" onSubmit={(e) => e.preventDefault()}>
      <Field label="Email" type="email" placeholder="you@example.com" />
      <Field
        label="Password"
        type="password"
        placeholder="••••••••"
        trailing={
          <span className="text-xs font-medium text-muted-foreground hover:text-foreground">
            Forgot?
          </span>
        }
      />
      <PrimaryButton>Sign in</PrimaryButton>
    </form>
    <FootLink lead="Don't have an account?" label="Sign up" />
  </AuthScaffold>
)

export const SignupMock = () => (
  <AuthScaffold>
    <BrandMark
      title="Create your account"
      subtitle="Start planning cozy weekly menus."
    />
    <form className="flex flex-col gap-4" onSubmit={(e) => e.preventDefault()}>
      <Field label="Email" type="email" placeholder="you@example.com" />
      <Field
        label="Password"
        type="password"
        placeholder="••••••••"
        hint="At least 8 characters."
      />
      <PrimaryButton>Create account</PrimaryButton>
    </form>
    <FootLink lead="Already have an account?" label="Sign in" />
  </AuthScaffold>
)

export const ConfirmEmailMock = () => (
  <AuthScaffold>
    <div className="flex flex-col items-center gap-3 text-center">
      <div className="flex size-12 items-center justify-center rounded-2xl bg-accent-tint text-accent-strong">
        <Mail className="size-6" />
      </div>
      <div className="flex flex-col gap-1">
        <h2 className="text-xl font-semibold tracking-tight">Check your inbox</h2>
        <p className="text-sm text-muted-foreground">
          We sent a verification link to{' '}
          <span className="font-medium text-foreground">you@example.com</span>.
          Click it to finish setting up your account.
        </p>
      </div>
    </div>
    <div className="flex flex-col items-center gap-3">
      <button
        type="button"
        className={cn(
          'inline-flex h-11 items-center justify-center gap-2 rounded-full border border-border bg-background px-5 text-sm font-medium transition hover:bg-muted',
        )}
      >
        <RotateCcw className="size-4" />
        Resend verification email
      </button>
      <FootLink lead="Wrong address?" label="Back to sign up" />
    </div>
  </AuthScaffold>
)
