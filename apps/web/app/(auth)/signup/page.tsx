import { SignupForm } from './signup-form'

const SignupPage = () => {
  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold">Create your account</h1>
        <p className="text-sm text-muted-foreground">
          We&apos;ll send a verification link to your inbox before you can sign in.
        </p>
      </header>
      <SignupForm />
    </div>
  )
}

export default SignupPage
