import type { PermissionKey, SessionUser } from './permissions'

export type PermissionGateResult = { status: 403; message: string }

/**
 * Decides whether a signed-in user may use a capability. Fails closed: no
 * session (nobody to attribute the request to) and missing permission both
 * refuse, and the refusal names the key that was required so the UI can tell
 * the user what to ask an administrator for.
 *
 * 403 for both cases, not 401: in this app 401 belongs to the Admin Console
 * shared secret (`lib/adminGate.ts`), and `services/adminUsersService.ts`
 * turns any 401 into "unlock the console with the secret" — a sign-in
 * problem must not look like a secret problem.
 */
export function permissionGate(
  user: SessionUser | null,
  required: PermissionKey,
): PermissionGateResult | null {
  if (!user) {
    return { status: 403, message: 'Sign-in required.' }
  }
  if (!user.permissions.includes(required)) {
    return { status: 403, message: `Missing permission: ${required}.` }
  }
  return null
}
