const VerifyEmailPage = () => {
  return (
    <div className="flex flex-col gap-4 text-center">
      <h1 className="text-2xl font-semibold">Check your email</h1>
      <p className="text-sm text-muted-foreground">
        We&apos;ve sent a verification link to your inbox. Click it to confirm your
        address — you&apos;ll be able to sign in afterwards.
      </p>
      <p className="text-sm text-muted-foreground">
        Wrong address?{' '}
        <a href="/signup" className="font-medium underline-offset-4 hover:underline">
          Sign up again
        </a>
        .
      </p>
    </div>
  )
}

export default VerifyEmailPage
