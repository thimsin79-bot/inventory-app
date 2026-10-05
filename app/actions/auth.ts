'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { unconfiguredErrorMessage } from '@/lib/supabase/env'
import {
  normalizeUsername,
  passwordProblem,
  safeNextPath,
  usernameProblem,
  usernameToEmail,
  type AuthState,
} from '@/lib/auth'

const INVALID_CREDENTIALS = /invalid login credentials/i
const EMAIL_TAKEN = /already (registered|been registered)|user already exists/i
const NOT_CONFIRMED = /email not confirmed/i
const RATE_LIMITED = /rate limit|too many|security purposes/i
const SIGNUP_DISABLED = /signups not allowed for this instance/i

type AuthErrorLike = { status?: number; message: string; code?: string }

function friendlyError(error: AuthErrorLike): string {
  if (error.status === 429 || RATE_LIMITED.test(error.message)) {
    return 'Too many attempts from this device. Wait a minute and try again.'
  }

  return error.message
}

/**
 * These accounts have no mailbox, so "confirm your email" can never be completed.
 * When the project still has confirmation enabled, say what is actually blocking
 * sign-in instead of telling the user to look for a message that will never arrive.
 */
function unconfirmedMessage(): string {
  return 'This account is still waiting to be approved. Accounts here are created without an email inbox, so there is no confirmation link to click — an administrator has to enable automatic confirmation.'
}

function isUnconfirmed(error: AuthErrorLike): boolean {
  return error.code === 'email_not_confirmed' || NOT_CONFIRMED.test(error.message)
}

/**
 * Sign-up is the only route to an account here. There is no invite flow and no
 * mailbox to send one to, so a project with sign-up switched off cannot onboard
 * anybody at all. GoTrue answers `422 signup_disabled`, which without this branch
 * reached the user verbatim as "Signups not allowed for this instance" — true, but
 * it names a Supabase concept rather than the switch an operator has to flip.
 */
function isSignupDisabled(error: AuthErrorLike): boolean {
  return error.code === 'signup_disabled' || SIGNUP_DISABLED.test(error.message)
}

function signupDisabledMessage(): string {
  return 'This instance is not accepting new accounts. Sign-up has to be switched back on under Authentication → Sign In / Providers → Email before anyone can register.'
}

export async function login(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const username = normalizeUsername(String(formData.get('username') ?? ''))
  const password = String(formData.get('password') ?? '')
  const nextPath = safeNextPath(String(formData.get('next') ?? ''))

  const badUsername = usernameProblem(username)
  if (badUsername) return { error: `Your username must ${badUsername}.`, username }
  if (!password) return { error: 'Enter your password.', username }

  // Report a missing deployment variable in the form rather than as a redacted
  // 500, which is the whole point of the check in lib/supabase/env.ts.
  const unconfigured = unconfiguredErrorMessage()
  if (unconfigured) return { error: unconfigured, username }

  const supabase = await createClient()

  const { error } = await supabase.auth.signInWithPassword({
    email: usernameToEmail(username),
    password,
  })

  if (error) {
    if (isUnconfirmed(error)) {
      return { error: unconfirmedMessage(), username }
    }

    return {
      error:
        error.status === 400 || INVALID_CREDENTIALS.test(error.message)
          ? 'That username and password combination is not valid.'
          : friendlyError(error),
      username,
    }
  }

  redirect(nextPath)
}

export async function signup(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const username = normalizeUsername(String(formData.get('username') ?? ''))
  const password = String(formData.get('password') ?? '')
  const confirmPassword = String(formData.get('confirmPassword') ?? '')
  const nextPath = safeNextPath(String(formData.get('next') ?? ''))

  const badUsername = usernameProblem(username)
  if (badUsername) return { error: `Your username must ${badUsername}.`, username }

  const weak = passwordProblem(password)
  if (weak) return { error: `Your password must ${weak}.`, username }

  if (password !== confirmPassword) {
    return { error: 'The two passwords do not match.', username }
  }

  const unconfigured = unconfiguredErrorMessage()
  if (unconfigured) return { error: unconfigured, username }

  const supabase = await createClient()

  const { data, error } = await supabase.auth.signUp({
    email: usernameToEmail(username),
    password,
    // user_metadata only. app_metadata carries the role that RLS reads and is
    // admin-controlled, so it must never be settable from a public form.
    options: { data: { username } },
  })

  if (error) {
    if (isSignupDisabled(error)) {
      return { error: signupDisabledMessage(), username }
    }

    return {
      error: EMAIL_TAKEN.test(error.message)
        ? 'That username is already taken. Try another one, or sign in.'
        : friendlyError(error),
      username,
    }
  }

  if (!data.session) {
    // No session means the project still requires email confirmation, which these
    // accounts can never satisfy. Point at the actual switch rather than dead-ending.
    return {
      message:
        'Account created, but it cannot sign in yet. Automatic confirmation has to be switched on (Authentication → Email) before a username account can be used.',
      username,
    }
  }

  redirect(nextPath)
}

export async function signOut(): Promise<void> {
  const supabase = await createClient()

  await supabase.auth.signOut()
  redirect('/login')
}