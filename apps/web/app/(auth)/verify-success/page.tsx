import Link from 'next/link'
import { CheckCircle2 } from 'lucide-react'
import { authPrimaryButtonClass } from '../_components/auth-ui'

const VerifySuccessPage = () => {
  return (
    <div className="flex flex-col items-center gap-4 text-center">
      <div className="flex size-12 items-center justify-center rounded-2xl bg-success-tint text-success">
        <CheckCircle2 className="size-6" aria-hidden />
      </div>
      <h1 className="text-2xl font-semibold">Email confirmed</h1>
      <p className="text-sm text-muted-foreground">
        You&apos;re all set — your account is verified and you&apos;re signed
        in. Jump in and start building your weekly plan.
      </p>
      <Link href="/dashboard" className={authPrimaryButtonClass}>
        Continue to dashboard
      </Link>
    </div>
  )
}

export default VerifySuccessPage
