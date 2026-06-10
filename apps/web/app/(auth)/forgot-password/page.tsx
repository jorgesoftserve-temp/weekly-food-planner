import { ForgotPasswordForm } from './forgot-password-form'

const ForgotPasswordPage = () => {
  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col items-center gap-1.5 text-center">
        <h1 className="text-2xl font-semibold">Forgot your password?</h1>
        <p className="text-sm text-muted-foreground">
          Enter your email and we&apos;ll send you a link to reset it.
        </p>
      </header>
      <ForgotPasswordForm />
    </div>
  )
}

export default ForgotPasswordPage
