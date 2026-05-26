import Link from 'next/link'
import { CheckCircle2 } from 'lucide-react'

const VerifySuccessPage = () => {
  return (
    <div className="flex flex-col items-center gap-4 text-center">
      <div className="flex size-12 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
        <CheckCircle2 className="size-6" aria-hidden />
      </div>
      <h1 className="text-2xl font-semibold">Email confirmed</h1>
      <p className="text-sm text-muted-foreground">
        You&apos;re all set — your account is verified and you&apos;re signed
        in. Jump in and start building your weekly plan.
      </p>
      <Link
        href="/dashboard"
        className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm hover:bg-primary/90"
      >
        Continue to dashboard
      </Link>
    </div>
  )
}

export default VerifySuccessPage
