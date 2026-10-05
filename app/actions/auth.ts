'use server'

import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { isEmail, passwordProblem, safeNextPath, type AuthState } from '@/lib/auth'

const INVALID_CREDENTIALS = /invalid login credentials/i
const EMAIL_TAKEN = /already (registered|been registered)|user already exists/i
const EMAIL_NOT_CONFIRMED = /email not confirmed/i
const RATE_LIMITED = /rate limit|too many|security purposes/i

type AuthErrorLike = { status?: number; message: string; code?: string }

function friendlyError(error: AuthErrorLike): string {
  if (error.status === 429 || RATE_LIMITED.test(error.message)) {
    return 'Too many attempts from this device. Wait a minute and try again.'
  }

  return error.message
}

/**
 * GoTrue reports an unconfirmed account as `email_not_confirmed` with HTTP 400,
 * the same status it uses for bad credentials. Branch on the code first so the
 * real cause reaches the user instead of a misleading "wrong password".
 */
function isUnconfirmed(error: AuthErrorLike): boolean {
  return error.code === 'email_not_confirmed' || EMAIL_NOT_CONFIRMED.test(error.message)
}

/**
 * Absolute callback URL for email confirmation links.
 *
 * Falls back to the forwarded protocol + host when the `Origin` header is
 * absent. Returning undefined omits `emailRedirectTo` entirely, which is
 * better than sending a value Supabase would reject.
 */
async function callbackUrl(nextPath: string): Promise<string | undefined> {
  const headerList = await headers()
  const origin = headerList.get('origin')

  if (origin?.startsWith('http')) {
    return `${origin}/auth/callback?next=${encodeURIComponent(nextPath)}`
  }

  const host = headerList.get('x-forwarded-host') ?? headerList.get('host')
  const protocol = headerList.get('x-forwarded-proto') ?? 'http'

  if (!host) return undefined

  return `${protocol}://${host}/auth/callback?next=${encodeURIComponent(nextPath)}`
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
    if (isUnconfirmed(error)) {
      return {
        error:
          'This account has not confirmed its email address yet. Open the confirmation link we sent you, or resend it below.',
        email,
        needsConfirmation: true,
      }
    }

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

export async function resendConfirmation(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const email = String(formData.get('email') ?? '').trim()
  const nextPath = safeNextPath(String(formData.get('next') ?? ''))

  if (!isEmail(email)) {
    return { error: 'Enter your email address.', email }
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.resend({
    type: 'signup',
    email,
    options: { emailRedirectTo: await callbackUrl(nextPath) },
  })

  if (error) {
    return {
      error: RATE_LIMITED.test(error.message)
        ? 'Too many resend requests. Wait a minute and try again.'
        : friendlyError(error),
      email,
      needsConfirmation: true,
    }
  }

  return {
    message: `Confirmation link sent to ${email}. Open it to finish setting up your account.`,
    email,
  }
}

export async function signOut(): Promise<void> {
  const supabase = await createClient()

  await supabase.auth.signOut()
  redirect('/login')
}
