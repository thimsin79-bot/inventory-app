import { createClient } from '@/lib/supabase/server'
import { permissionGate, type PermissionGateResult } from '@/lib/permissionGate'
import { sessionFromAuth, type PermissionKey, type SessionUser } from '@/lib/permissions'

/**
 * Reads the caller's session on the server: `getClaims()` validates the
 * access token (refreshing it first when it is about to expire, which also
 * refreshes the cookies through the client's setAll) rather than trusting
 * whatever is sitting in the cookie jar.
 */
export async function getSessionUser(): Promise<SessionUser | null> {
  try {
    const supabase = await createClient()
    const { data, error } = await supabase.auth.getClaims()
    if (error || !data?.claims) return null
    return sessionFromAuth(data.claims)
  } catch {
    return null
  }
}

/**
 * The session-side half of a route's access control: run it after
 * `adminSecretGate` and before any credential is touched, and turn a
 * non-null result straight into a 403 response.
 */
export async function permissionCheck(required: PermissionKey): Promise<PermissionGateResult | null> {
  return permissionGate(await getSessionUser(), required)
}
