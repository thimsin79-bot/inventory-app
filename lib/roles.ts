/**
 * Role checks.
 *
 * Kept free of Next.js and Supabase imports so `npm run check:auth` can exercise
 * them directly. The distinction that matters is `app_metadata` versus
 * `user_metadata`.
 */

type RoleSource = {
  app_metadata?: Record<string, unknown> | null
  user_metadata?: Record<string, unknown> | null
}

/**
 * Reads the role claim that RLS enforces, which lives in `app_metadata`.
 *
 * `supabase/schema.sql` gates every policy on
 * `auth.jwt() -> 'app_metadata' ->> 'role'`. Only a Service Role key or the
 * dashboard can write `app_metadata`; `user_metadata` is writable by the account
 * holder through `supabase.auth.updateUser`.
 *
 * Reading `user_metadata` here would be a privilege-escalation bug, not a style
 * choice: anyone could set `{"role":"admin"}` on themselves and then pass this
 * check. The test suite pins that down.
 */
export function roleOf(user: RoleSource): string | null {
  const role = user.app_metadata?.role
  return typeof role === 'string' ? role : null
}

export function isAdmin(user: RoleSource): boolean {
  return roleOf(user) === 'admin'
}