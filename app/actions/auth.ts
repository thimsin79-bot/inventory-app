'use server'

import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { isEmail, passwordProblem, safeNextPath, type AuthState } from '@/lib/auth'

const INVALID_CREDENTIALS = /invalid login credentials/i
const EMAIL_TAKEN = /already (registered|been registered)|user already exists/i
const RATE_LIMITED = /rate limit|too many|security purposes/i

function friendlyError(error: { status?: number; message: string }): string {
  if (error.status === 429 || RATE_LIMITED.test(error.message)) {
    return 'Too many attempts from this device. Wait a minute and try again.'
  }

  return error.message
}

/** Absolute callback URL for email confirmation links, when the host is known. */
async function callbackUrl(nextPath: string): Promise<string | undefined> {
  const headerList = await headers()
  const origin = headerList.get('origin')

  if (!origin?.startsWith('http')) return undefined

  return `${origin}/auth/callback?next=${encodeURIComponent(nextPath)}`
}

export async function login(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const email = String(formData.get('email') ?? '').trim()
  const password = String(formData.get('password') ?? '')
  const nextPath = safeNextPath(String(formData.get('next') ?? ''))

  if (!isEmail(email) || !password) {
    return { error: 'Enter your email address and password.', email }
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithPassword({ email, password })

  if (error) {
    return {
      error:
        error.status === 400 || INVALID_CREDENTIALS.test(error.message)
          ? 'That email and password combination is not valid.'
          : friendlyError(error),
      email,
    }
  }

  redirect(nextPath)
}

export async function signup(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const name = String(formData.get('name') ?? '').trim()
  const email = String(formData.get('email') ?? '').trim()
  const password = String(formData.get('password') ?? '')
  const confirmPassword = String(formData.get('confirmPassword') ?? '')
  const nextPath = safeNextPath(String(formData.get('next') ?? ''))

  if (name.length < 2) {
    return { error: 'Enter your full name.', name, email }
  }

  if (!isEmail(email)) {
    return { error: 'Enter a valid email address.', name, email }
  }

  const weak = passwordProblem(password)

  if (weak) {
    return { error: `Your password must ${weak}.`, name, email }
  }

  if (password !== confirmPassword) {
    return { error: 'The two passwords do not match.', name, email }
  }

  const supabase = await createClient()
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { full_name: name },
      emailRedirectTo: await callbackUrl(nextPath),
    },
  })

  if (error) {
    return {
      error: EMAIL_TAKEN.test(error.message)
        ? 'An account with that email already exists. Sign in instead.'
        : friendlyError(error),
      name,
      email,
    }
  }

  if (!data.session) {
    return {
      message: 'Account created. Check your inbox for the confirmation link, then sign in.',
      name,
      email,
    }
  }

  redirect(nextPath)
}

export async function signOut(): Promise<void> {
  const supabase = await createClient()

  await supabase.auth.signOut()
  redirect('/login')
}
