import { LoginForm } from './login-form'

const LoginPage = () => {
  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col items-center gap-1.5 text-center">
        <h1 className="text-2xl font-semibold">Welcome back</h1>
        <p className="text-sm text-muted-foreground">
          Sign in to plan your week.
        </p>
      </header>
      <LoginForm />
    </div>
  )
}

export default LoginPage
