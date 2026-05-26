import { ResetPasswordForm } from './reset-password-form'

const ResetPasswordPage = () => {
  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold">Choose a new password</h1>
        <p className="text-sm text-muted-foreground">
          Pick something you haven&apos;t used here before. You&apos;ll be
          signed in automatically.
        </p>
      </header>
      <ResetPasswordForm />
    </div>
  )
}

export default ResetPasswordPage
