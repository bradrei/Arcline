import { SignUpForm } from '@/app/(auth)/_components/SignUpForm'

export const metadata = { title: 'Create account — Arcline' }

export default function SignUpPage() {
  return (
    <>
      <h1 className="mb-2 text-2xl font-bold text-foreground">Create your account</h1>
      <p className="mb-8 text-sm text-foreground-muted">
        Start training smarter. Your plan adapts every time you log a session.
      </p>
      <SignUpForm />
    </>
  )
}
