import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import type { Database } from '@/types/database.types'
import { readSupabaseEnv } from '@/lib/supabase/env'

/**
 * Creates a Supabase client configured for Server Components,
 * Server Actions, and Route Handlers.
 * Uses Next.js async cookies() API.
 *
 * Throws a named error when the environment is incomplete, rather than passing
 * `undefined` to the SDK and failing somewhere inside it.
 */
export async function createClient() {
  const cookieStore = await cookies()
  const { url, key } = readSupabaseEnv()

  return createServerClient<Database>(url, key, {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options)
          })
        } catch {
          // The `setAll` method was called from a Server Component, where
          // cookies are read-only. Nothing here writes a session cookie any more,
          // so there is nothing to persist.
        }
      },
    },
  })
}

