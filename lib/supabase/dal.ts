import { cache } from 'react'
import { redirect } from 'next/navigation'
import type { User } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { supabaseEnvProblems } from '@/lib/supabase/env'
import { emailToUsername } from '@/lib/auth'

/**
 * Data access layer for the current session.
 *
 * Memoized per render pass so the auth check runs once even when several
 * components ask for the user. Pages and route handlers should read the user
 * through here instead of calling supabase.auth directly.
 */
export const getUser = cache(async (): Promise<User | null> => {
  // With no Supabase configuration there is provably no session, so returning
  // null is accurate rather than a bypass. Protected routes are already refused
  // by the proxy, and requireUser still redirects, so this only decides whether
  // /login renders or 500s. The message names variables only, never values.
  const problems = supabaseEnvProblems()

  if (problems.length > 0) {
    console.error('[auth] Supabase is not configured:', problems.join('; '))
    return null
  }

  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  return user ?? null
})

/** Throws a redirect to /login when there is no valid session. */
export async function requireUser(): Promise<User> {
  const user = await getUser()

  if (!user) {
    redirect('/login')
  }

  return user
}

export function displayName(user: User): string {
  const meta = user.user_metadata as
    | { username?: string; full_name?: string; name?: string }
    | null

  // Prefer the username, so the UI never renders the synthetic @users.invalid
  // address that stands in for one behind the scenes.
  return (
    meta?.username ??
    meta?.full_name ??
    meta?.name ??
    emailToUsername(user.email) ??
    user.email ??
    'Signed in'
  )
}
