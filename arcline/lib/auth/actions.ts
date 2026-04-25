'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export async function signUp(
  _prevState: { error: string } | null,
  formData: FormData
): Promise<{ error: string }> {
  const email = (formData.get('email') as string | null)?.trim() ?? ''
  const password = (formData.get('password') as string | null) ?? ''

  if (!email || !password) return { error: 'Email and password are required.' }
  if (password.length < 8) return { error: 'Password must be at least 8 characters.' }

  const supabase = await createClient()
  const { error } = await supabase.auth.signUp({ email, password })

  if (error) return { error: error.message }

  redirect('/app/onboarding')
}

export async function login(
  _prevState: { error: string } | null,
  formData: FormData
): Promise<{ error: string }> {
  const email = (formData.get('email') as string | null)?.trim() ?? ''
  const password = (formData.get('password') as string | null) ?? ''

  if (!email || !password) return { error: 'Email and password are required.' }

  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithPassword({ email, password })

  if (error) return { error: 'Invalid email or password.' }

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Authentication failed. Please try again.' }

  const { data: profile } = await supabase
    .from('profiles')
    .select('onboarding_complete')
    .eq('id', user.id)
    .single()

  redirect(profile?.onboarding_complete ? '/app/dashboard' : '/app/onboarding')
}

export async function logout(): Promise<void> {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/login')
}
