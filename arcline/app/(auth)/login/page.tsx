import { LoginForm } from '@/app/(auth)/_components/LoginForm'

export const metadata = { title: 'Sign in — Arcline' }

export default function LoginPage() {
  return (
    <>
      <h1 className="mb-2 text-2xl font-bold text-foreground">Welcome back</h1>
      <p className="mb-8 text-sm text-foreground-muted">
        Sign in to see your plan and log your next session.
      </p>
      <LoginForm />
    </>
  )
}
