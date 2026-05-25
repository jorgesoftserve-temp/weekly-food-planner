import { LoginForm } from './login-form'

const LoginPage = () => {
  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold">Sign in</h1>
        <p className="text-sm text-muted-foreground">
          Welcome back. Enter your credentials to continue.
        </p>
      </header>
      <LoginForm />
    </div>
  )
}

export default LoginPage
