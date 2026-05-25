import { redirect } from 'next/navigation'

// The middleware gates /dashboard for unauthenticated users (redirects to
// /login) and bounces authenticated users away from /login. Sending the root
// route through /dashboard keeps a single canonical "where am I?" answer.
const HomePage = () => {
  redirect('/dashboard')
}

export default HomePage
