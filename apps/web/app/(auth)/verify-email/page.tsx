import { Mail } from 'lucide-react'
import { VerifyEmailPanel } from './verify-email-panel'
import { authLinkClass } from '../_components/auth-ui'

const VerifyEmailPage = () => {
  return (
    <div className="flex flex-col items-center gap-4 text-center">
      <div className="flex size-12 items-center justify-center rounded-2xl bg-accent-tint text-accent-strong">
        <Mail className="size-6" aria-hidden />
      </div>
      <div className="flex flex-col gap-1.5">
        <h1 className="text-2xl font-semibold">Check your email</h1>
        <p className="text-sm text-muted-foreground">
          We&apos;ve sent a verification link to your inbox. Click it to confirm
          your address — you&apos;ll be signed in afterwards.
        </p>
      </div>
      <VerifyEmailPanel />
      <p className="text-sm text-muted-foreground">
        Wrong address?{' '}
        <a href="/signup" className={authLinkClass}>
          Sign up again
        </a>
      </p>
    </div>
  )
}

export default VerifyEmailPage
