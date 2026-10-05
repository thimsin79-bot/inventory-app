import { createBrowserClient } from '@supabase/ssr'
import type { Database } from '@/types/database.types'
import { readSupabaseEnv } from '@/lib/supabase/env'

/**
 * Creates a Supabase client configured for Client Components.
 * Persists session tokens using browser cookies.
 *
 * Throws a named error when the environment is incomplete. `readSupabaseEnv`
 * works in the browser because Next.js inlines `NEXT_PUBLIC_*` at build time.
 */
export function createClient() {
  const { url, key } = readSupabaseEnv()

  return createBrowserClient<Database>(url, key)
}

