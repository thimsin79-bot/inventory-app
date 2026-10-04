import { cache } from 'react'
import { redirect } from 'next/navigation'
import type { User } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'

/**
 * Data access layer for the current session.
 *
 * Memoized per render pass so the auth check runs once even when several
 * components ask for the user. Pages and route handlers should read the user
 * through here instead of calling supabase.auth directly.
 */
export const getUser = cache(async (): Promise<User | null> => {
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
  const meta = user.user_metadata as { full_name?: string; name?: string } | null

  return meta?.full_name ?? meta?.name ?? user.email ?? 'Signed in'
}
